import { Router } from "express";
import { requireCapability } from "../middleware/rbac.js";
import { requireMainnetAllowlist } from "../middleware/mainnetGate.js";
import { requireCtx } from "../context.js";
import {
  agentToggleSchema,
  prepareMoveSchema,
  rebalanceSchema,
  submitMoveSchema,
  treasuryConfigSchema,
} from "../schemas.js";

/**
 * Recursively convert BigInt → string so a Soroban contract's native return
 * value (e.g. an i128 position decoded as BigInt) survives `res.json()`.
 * `JSON.stringify` throws on BigInt, which otherwise surfaces as a 500.
 */
function jsonSafe(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, jsonSafe(val)]));
  }
  return v;
}

export function treasuryRouter(): Router {
  const router = Router();

  router.get("/", requireCapability("treasury.read"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      res.json(await req.container.treasury.snapshot(ctx.tenantId));
    } catch (e) {
      next(e);
    }
  });

  router.put("/config", requireCapability("treasury.configure"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const body = treasuryConfigSchema.parse(req.body);
      const saved = await req.container.treasury.saveConfig(
        { tenantId: ctx.tenantId, ...body },
        ctx.userId,
      );
      res.json(saved);
    } catch (e) {
      next(e);
    }
  });

  // Activate / deactivate the autonomous agent — gated by a SEP-53 wallet
  // signature so the delegation is an explicit, auditable consent by the owner.
  router.post("/agent", requireCapability("treasury.configure"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const b = agentToggleSchema.parse(req.body);

      // 1. The message must carry a valid ed25519 signature from `address`.
      if (!req.container.walletAuth.verifySignedMessage(b.address, b.message, b.signedMessage)) {
        res.status(400).json({ error: "Invalid wallet signature." });
        return;
      }
      // 2. The signer must be the signed-in user's own wallet.
      const user = await req.container.repo.findUserByWallet(b.address);
      if (!user || user.id !== ctx.userId) {
        res.status(403).json({ error: "Signature does not match your wallet." });
        return;
      }
      // 3. The consent must match the action and be fresh (≤5 min).
      const okAction = new RegExp(`Action:\\s*${b.enabled ? "enable" : "disable"}`, "i").test(b.message);
      const issued = b.message.match(/Issued:\s*(.+)/i)?.[1]?.trim();
      const fresh = issued ? Date.now() - Date.parse(issued) < 5 * 60_000 : false;
      if (!okAction || !fresh) {
        res.status(400).json({ error: "Consent message invalid or expired." });
        return;
      }

      // 4. Apply + record the signed consent (auditable authorization artifact).
      const saved = await req.container.treasury.setAgentEnabled(ctx.tenantId, b.enabled, ctx.userId);
      await req.container.audit.record({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        actorType: "user",
        action: "treasury.configured",
        detail: { agentEnabled: saved.agentEnabled, signedConsent: true, address: b.address, signature: b.signedMessage.slice(0, 24) },
      });
      res.json({ agentEnabled: saved.agentEnabled });
    } catch (e) {
      next(e);
    }
  });

  router.post("/rebalance", requireCapability("treasury.rebalance"), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const body = rebalanceSchema.parse(req.body);
      const result = await req.container.treasury.rebalance({
        tenantId: ctx.tenantId,
        ...body,
        actorId: ctx.userId,
        actorType: ctx.isAgent ? "agent" : "user",
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  // ── Self-custody (user-signed) move ──────────────────────────────────────
  // 1) Build an unsigned tx the user signs in their own wallet (Freighter).
  router.post("/prepare", requireCapability("treasury.rebalance"), requireMainnetAllowlist(), async (req, res, next) => {
    try {
      requireCtx(req);
      const b = prepareMoveSchema.parse(req.body);
      let xdr: string;
      try {
        if (b.venue === "defindex") {
          if (!req.container.defindex.live) throw new Error("DeFindex is not live.");
          xdr = await req.container.defindex.buildUserXdr(
            b.address,
            b.direction === "supply" ? "deposit" : "withdraw",
            b.amountBaseUnits,
          );
        } else {
          if (!req.container.blend.live) throw new Error("Blend is not live.");
          xdr = await req.container.blend.buildRequestXdr(b.address, b.direction, b.asset, b.amountBaseUnits);
        }
      } catch (opErr) {
        // Surface the on-chain/upstream reason (the generic handler hides it).
        res.status(400).json({ error: opErr instanceof Error ? opErr.message : String(opErr) });
        return;
      }
      res.json({ xdr });
    } catch (e) {
      next(e);
    }
  });

  // 2) Submit the user-signed envelope. LCP-bound + audited, like every settle.
  router.post("/submit", requireCapability("treasury.rebalance"), requireMainnetAllowlist(), async (req, res, next) => {
    try {
      const ctx = requireCtx(req);
      const { signedXdr } = submitMoveSchema.parse(req.body);
      // Wrap bind + submit + audit so the real reason surfaces (not a 500).
      try {
        const binding = await req.container.legal.bindForAction(ctx.tenantId, ["treasury-management"]);
        const r = await req.container.blend.submitSignedXdr(signedXdr);
        await req.container.audit.record({
          tenantId: ctx.tenantId,
          actorId: ctx.userId,
          actorType: "user",
          action: "treasury.rebalanced",
          detail: { txHash: r.txHash, selfCustody: true },
          legalContextId: binding.contextId,
        });
        res.json({ txHash: r.txHash, legalContextHash: binding.hash, returnValue: jsonSafe(r.returnValue) });
      } catch (opErr) {
        res.status(400).json({ error: opErr instanceof Error ? opErr.message : String(opErr) });
      }
    } catch (e) {
      next(e);
    }
  });

  return router;
}
