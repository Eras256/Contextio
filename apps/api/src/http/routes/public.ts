import { Router } from "express";
import { env } from "../../env.js";

/**
 * Public, unauthenticated read of the autonomous agent's recent activity for the
 * demo tenant — powers the Home live feed. Returns only sanitized, non-sensitive
 * fields. Rate-limited at the mount point.
 */
export function publicRouter(): Router {
  const router = Router();

  router.get("/activity", async (req, res, next) => {
    try {
      const config = env();
      const base = {
        agentAddress: config.AGENT_PUBLIC_ADDRESS || null,
        network: config.STELLAR_NETWORK,
        contracts: {
          treasury: config.TREASURY_CONTRACT_ID || null,
          payroll: config.PAYROLL_CONTRACT_ID || null,
        },
      };
      const tenantId = config.PUBLIC_ACTIVITY_TENANT_ID || config.AUTH_DEMO_TENANT_ID;
      if (!tenantId) {
        res.json({ ...base, decisions: [] });
        return;
      }
      const all = await req.container.repo.listDecisions(tenantId);
      const decisions = all.slice(0, 12).map((d) => ({
        id: d.id,
        action: d.action,
        rationale: d.rationale,
        status: d.status,
        stellarTxHash: d.stellarTxHash,
        legalContextHash: d.legalContextHash,
        createdAt: d.createdAt,
      }));
      res.setHeader("cache-control", "public, max-age=5");
      res.json({ ...base, decisions });
    } catch (e) {
      next(e);
    }
  });

  /**
   * Public, read-only treasury snapshot for the demo tenant, same shape as the
   * authenticated `GET /treasury` — lets /treasury on the web app render real
   * data before a visitor connects a wallet. Never accepts a caller-supplied
   * tenant id; only ever reads the one tenant configured for public display.
   */
  router.get("/treasury", async (req, res, next) => {
    try {
      const config = env();
      const tenantId = config.PUBLIC_ACTIVITY_TENANT_ID || config.AUTH_DEMO_TENANT_ID;
      if (!tenantId) {
        res.json({ config: null, positions: [], totals: { liquidBaseUnits: "0", yieldBaseUnits: "0", totalBaseUnits: "0", yieldShareBps: 0 } });
        return;
      }
      res.setHeader("cache-control", "public, max-age=5");
      res.json(await req.container.treasury.snapshot(tenantId));
    } catch (e) {
      next(e);
    }
  });

  /**
   * Public, read-only payroll snapshot for the demo tenant (employees are the
   * seeded "Acme LATAM" fixtures, not real people — see supabase/seed.sql).
   * Same shape as the three authenticated GETs it mirrors, bundled into one
   * response so the web app can render /payroll without a wallet connected.
   */
  router.get("/payroll", async (req, res, next) => {
    try {
      const config = env();
      const tenantId = config.PUBLIC_ACTIVITY_TENANT_ID || config.AUTH_DEMO_TENANT_ID;
      if (!tenantId) {
        res.json({ employees: [], obligations: [], runs: [] });
        return;
      }
      const [employees, obligations, runs] = await Promise.all([
        req.container.payroll.listEmployees(tenantId),
        req.container.payroll.upcomingObligations(tenantId),
        req.container.payroll.listRuns(tenantId),
      ]);
      res.setHeader("cache-control", "public, max-age=5");
      res.json({ employees, obligations, runs });
    } catch (e) {
      next(e);
    }
  });

  /**
   * Public, read-only Legal Context Protocol state for the demo tenant, same
   * shape as the authenticated `GET /legal`. Lets /agent show the real,
   * published document and its hash before a visitor connects a wallet.
   */
  router.get("/legal", async (req, res, next) => {
    try {
      const config = env();
      const tenantId = config.PUBLIC_ACTIVITY_TENANT_ID || config.AUTH_DEMO_TENANT_ID;
      if (!tenantId) {
        res.json({ published: false });
        return;
      }
      const current = await req.container.legal.getForTenant(tenantId);
      if (!current) {
        res.json({ published: false });
        return;
      }
      res.setHeader("cache-control", "public, max-age=30");
      res.json({
        published: true,
        hash: current.hash,
        document: current.document,
        reviewStatus: "interim",
        reviewNote: "Pending review by a licensed attorney. Not yet final or legally binding.",
      });
    } catch (e) {
      next(e);
    }
  });

  /**
   * Public, read-only snapshot of the live DeFindex vault the platform uses for
   * real yield (APY, TVL, our position). Powers the Integrations page. Returns
   * { live:false } when DeFindex runs in mock mode.
   */
  router.get("/defindex", async (req, res, next) => {
    try {
      const dfx = req.container.defindex;
      if (!dfx.live) {
        res.json({ live: false });
        return;
      }
      const r = await dfx.getVaultData();
      res.setHeader("cache-control", "public, max-age=30");
      if (!r.ok) {
        res.json({ live: true, vault: null, error: r.error.message });
        return;
      }
      res.json({ live: true, vault: r.value });
    } catch (e) {
      next(e);
    }
  });

  /**
   * Public, read-only status of the LLM that powers the agent's reasoning. Lets
   * the UI show (and the navbar selector reflect) which AI is live. Exposes no
   * secrets — only provider + model when configured.
   */
  router.get("/ai", (req, res) => {
    const ai = req.container.ai;
    res.setHeader("cache-control", "public, max-age=30");
    res.json({
      live: ai.live,
      provider: ai.live ? ai.provider : "none",
      model: ai.live ? ai.model : null,
    });
  });

  /** Live XLM/USD price from the Reflector on-chain oracle (SEP-40) — powers the
   *  treasury's USD valuation. Read-only, public. */
  router.get("/oracle", async (req, res, next) => {
    try {
      const r = req.container.reflector;
      const xlmUsd = await r.getUsdPrice("XLM");
      res.setHeader("cache-control", "public, max-age=12");
      res.json({
        live: xlmUsd != null,
        provider: "reflector",
        network: env().STELLAR_NETWORK,
        source: r.source,
        prices: { XLM: xlmUsd },
      });
    } catch (e) {
      next(e);
    }
  });

  /** Public, read-only snapshot of the live Blend pool reserve the platform lends into. */
  router.get("/blend", async (req, res, next) => {
    try {
      const blend = req.container.blend;
      if (!blend.live) {
        res.json({ live: false });
        return;
      }
      const r = await blend.getVaultData();
      res.setHeader("cache-control", "public, max-age=30");
      res.json(r.ok ? { live: true, vault: r.value } : { live: true, vault: null, error: r.error.message });
    } catch (e) {
      next(e);
    }
  });

  /**
   * Public, read-only SEP-24 off-ramp anchor capabilities (SEP-1 toml + SEP-24
   * /info). Shows the real testnet anchor the platform would use to off-ramp USDC
   * to local rails (PIX/Bre-B in production). Read-only — moves no funds.
   */
  router.get("/anchor", async (_req, res, next) => {
    try {
      const config = env();
      // The default ANCHOR_SEP24_URL is SDF's *testnet* reference anchor. On a
      // mainnet deployment, serving its data would misrepresent a testnet-only
      // anchor as a real production capability — there is no licensed mainnet
      // anchor configured yet (see README "Production last mile"). Say so
      // plainly instead of silently fetching testnet data under a mainnet label.
      if (config.STELLAR_NETWORK === "mainnet" && config.ANCHOR_SEP24_URL.includes("testanchor.stellar.org")) {
        res.json({
          live: false,
          network: "mainnet",
          reason: "No licensed production SEP-24 anchor configured yet — local off-ramp (PIX/Bre-B) requires one.",
        });
        return;
      }
      const base = config.ANCHOR_SEP24_URL.replace(/\/$/, "");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const toml = await (await fetch(`${base}/.well-known/stellar.toml`, { signal: ctrl.signal })).text();
        const grab = (k: string) => toml.match(new RegExp(`${k}\\s*=\\s*"([^"]+)"`))?.[1] ?? null;
        const transferServer = grab("TRANSFER_SERVER_SEP0024");
        const webAuth = grab("WEB_AUTH_ENDPOINT");
        let withdraw: string[] = [];
        let deposit: string[] = [];
        if (transferServer) {
          const info = (await (await fetch(`${transferServer.replace(/\/$/, "")}/info`, { signal: ctrl.signal })).json()) as {
            withdraw?: Record<string, unknown>;
            deposit?: Record<string, unknown>;
          };
          withdraw = Object.keys(info.withdraw ?? {});
          deposit = Object.keys(info.deposit ?? {});
        }
        res.setHeader("cache-control", "public, max-age=300");
        res.json({
          live: Boolean(transferServer),
          anchor: base.replace(/^https?:\/\//, ""),
          transferServer,
          webAuth,
          protocols: ["SEP-1", "SEP-10", "SEP-24"],
          withdraw,
          deposit,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      next(e);
    }
  });

  /**
   * Real SEP-38 indicative price from Contextio's own self-hosted Anchor
   * Platform (infra/anchor-platform/) — the firm quote a SEP-31
   * institutional send would use instead of an estimated FX buffer. Prices
   * XLM against iso4217:USD/BRL/ARS/COP — real LatAm corridors the old SDF
   * reference anchor never covered (USD/CAD only). Read-only, moves no funds.
   */
  router.get("/anchor/sep38", async (req, res, next) => {
    try {
      const config = env();
      if (config.STELLAR_NETWORK === "mainnet" && config.ANCHOR_SEP3138_URL.includes("contextio-anchor-platform")) {
        res.json({
          live: false,
          network: "mainnet",
          reason: "No licensed production SEP-31/38 anchor configured yet.",
        });
        return;
      }
      const sellAsset = typeof req.query.sellAsset === "string" ? req.query.sellAsset : "stellar:native";
      const sellAmount = typeof req.query.sellAmount === "string" ? req.query.sellAmount : "100";
      const prices = await req.container.anchor.getSep38Prices(sellAsset, sellAmount);
      res.setHeader("cache-control", "public, max-age=60");
      res.json({ live: true, protocol: "SEP-38", sellAsset, sellAmount, prices });
    } catch (e) {
      next(e);
    }
  });

  /**
   * Real SEP-31 capabilities (which assets Contextio's own self-hosted
   * anchor accepts for institutional cross-border send — native/BRL/ARS/COP,
   * all with real receive limits and funding methods configured, unlike the
   * old SDF reference anchor whose own /sep31/info returns an empty
   * `receive` map). Read-only discovery, no funds moved — actually *sending*
   * still needs a licensed local off-ramp partner (business step, not code);
   * this proves the protocol integration itself is real.
   */
  router.get("/anchor/sep31", async (req, res, next) => {
    try {
      const config = env();
      if (config.STELLAR_NETWORK === "mainnet" && config.ANCHOR_SEP3138_URL.includes("contextio-anchor-platform")) {
        res.json({
          live: false,
          network: "mainnet",
          reason: "No licensed production SEP-31/38 anchor configured yet.",
        });
        return;
      }
      const info = await req.container.anchor.getSep31Info();
      res.setHeader("cache-control", "public, max-age=300");
      res.json({ live: true, protocol: "SEP-31", info });
    } catch (e) {
      next(e);
    }
  });

  /**
   * Public, read-only status of the OpenZeppelin Channels fee-sponsorship
   * relayer. Lets the Integrations page show whether sponsored (gasless)
   * submission is actually configured — no secrets exposed, just a boolean.
   */
  router.get("/relayer", (req, res) => {
    const relayer = req.container.relayer;
    res.setHeader("cache-control", "public, max-age=30");
    res.json({
      live: relayer.enabled,
      provider: "openzeppelin-channels",
      network: env().STELLAR_NETWORK,
    });
  });

  /**
   * Public, read-only status of the BlindPay off-ramp integration (Milestone
   * 2, licensed-partner side — see TECHNICAL.md §6). No secrets exposed,
   * just whether a real sandbox/production instance is configured yet.
   */
  router.get("/blindpay", (req, res) => {
    const blindpay = req.container.blindpay;
    res.setHeader("cache-control", "public, max-age=30");
    res.json({
      live: blindpay.enabled,
      provider: "blindpay",
      network: env().STELLAR_NETWORK,
    });
  });

  /**
   * Start a REAL SEP-24 off-ramp on testnet: SEP-10 auth (challenge → sign →
   * JWT) + SEP-24 interactive withdraw → the anchor's hosted off-ramp URL. This
   * is the genuine mechanism that settles to PIX/Bre-B via a licensed anchor in
   * production. No funds move here — KYC + amount happen on the anchor's page.
   */
  router.get("/anchor/withdraw", async (req, res) => {
    try {
      const config = env();
      if (config.STELLAR_NETWORK === "mainnet" && config.ANCHOR_SEP24_URL.includes("testanchor.stellar.org")) {
        res.status(503).json({ ok: false, error: "No licensed production SEP-24 anchor configured yet." });
        return;
      }
      const asset = typeof req.query.asset === "string" ? req.query.asset : "USDC";
      const r = await req.container.anchor.initiateWithdraw(asset);
      res.json({ ok: true, ...r });
    } catch (e) {
      res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
