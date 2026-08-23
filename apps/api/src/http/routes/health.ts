import { Router } from "express";

/**
 * Liveness + readiness. `/healthz` is used by Fly.io's health check (always
 * cheap). `/readyz` probes downstream dependencies (Supabase, Stellar RPC).
 */
export function healthRouter(): Router {
  const router = Router();

  // Friendly service index so the base URL isn't a bare 404. Lists the public
  // entry points; everything else lives under the authenticated /api/v1 surface.
  router.get("/", (_req, res) => {
    res.json({
      name: "Contextio API",
      status: "ok",
      docs: "https://github.com/contextio/Contextio",
      endpoints: {
        health: "/healthz",
        readiness: "/readyz",
        legalContext: "/.well-known/contextio-legal-context.json",
        api: "/api/v1",
      },
    });
  });

  router.get("/healthz", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  router.get("/readyz", async (req, res) => {
    const { repo, soroban, defindex, blend } = req.container;
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    try {
      await repo.getTenantByDomain("__readiness_probe__");
      checks.supabase = { ok: true };
    } catch (e) {
      checks.supabase = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }

    const health = await soroban.health();
    checks.stellar = health.ok
      ? { ok: true, detail: health.value.status }
      : { ok: false, detail: health.error.message };

    checks.defindex = { ok: true, detail: defindex.live ? "live" : "mock" };
    checks.blend = { ok: true, detail: blend.live ? "live" : "mock" };

    const ready = Object.values(checks).every((c) => c.ok);
    res.status(ready ? 200 : 503).json({ ready, checks });
  });

  return router;
}
