import { Router } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireCtx, HttpError } from "../context.js";
import { publishLegalSchema } from "../schemas.js";

/**
 * Tenant-scoped legal context management. The public `.well-known` document is
 * served by a separate, unauthenticated router (wellKnownRouter) so that agents
 * and counterparties can fetch terms without credentials.
 */
export function legalRouter(): Router {
  const router = Router();

  router.get("/", requireCapability("legal.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const current = await req.container.legal.getForTenant(ctx.tenantId);
      if (!current) {
        res.json({ published: false });
        return;
      }
      // Sibling metadata, deliberately outside `document` — hashLegalContext()
      // hashes only the canonical document, so this never affects the on-chain
      // hash or third-party verification. Declared, not hidden: until a
      // licensed attorney signs off, nobody consuming this should treat the
      // dispute-resolution/governing-law terms as final (mirrors the banner on
      // the public /legal-context page).
      res.json({
        published: true,
        hash: current.hash,
        document: current.document,
        reviewStatus: "interim",
        reviewNote: "Pending review by a licensed attorney — not yet final or legally binding.",
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/publish", requireCapability("legal.publish"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const body = publishLegalSchema.parse(req.body);
      const tenant = await req.container.repo.getTenant(ctx.tenantId);
      const result = await req.container.legal.publish({
        tenantId: ctx.tenantId,
        tenantDomain: tenant.domain,
        actorId: ctx.userId,
        ...body,
      });
      await req.container.audit.record({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: "legal.context.published",
        detail: { hash: result.hash, url: result.url },
        legalContextId: result.document.contextId,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

/**
 * Serves `https://{tenant-domain}/.well-known/contextio-legal-context.json`. In this
 * platform we resolve the tenant by the Host header (or `?domain=` for local
 * testing) — in production each tenant maps this path on their own domain.
 *
 * Deliberately NOT served at `/.well-known/legal-context.json` — that path
 * is reserved by the AAA/Integra Ledger/SDF "Legal Context Protocol" open
 * standard (legalcontextprotocol.org, launched June 2026). Our document
 * predates that standard and uses an unrelated schema; serving it at the
 * same well-known path would collide with a real, SDF-co-founded standard.
 */
export function wellKnownRouter(): Router {
  const router = Router();

  router.get("/contextio-legal-context.json", async (req, res, next) => {
    try {
      const domain =
        (req.query.domain as string | undefined) ?? req.hostname ?? req.header("host") ?? "";
      const doc = await req.container.legal.getForDomain(domain);
      if (!doc) {
        throw new HttpError(404, `No legal context published for domain '${domain}'`);
      }
      res.setHeader("content-type", "application/json");
      res.setHeader("cache-control", "public, max-age=300");
      res.send(JSON.stringify(doc, null, 2));
    } catch (e) {
      next(e);
    }
  });

  return router;
}
