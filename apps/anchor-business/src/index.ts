import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { createLogger, stellar } from "@contextio/shared";
import { env } from "./env.js";
import { ReflectorClient } from "./reflector.js";
import { getCustomerHandler, putCustomerHandler, deleteCustomerHandler } from "./customer.js";
import { rateHandler } from "./rate.js";

/**
 * The "business server" behind Contextio's self-hosted Anchor Platform.
 * Implements the callback API contract the `platform` service calls on us
 * (GET/PUT/DELETE /customer, GET /rate) — the piece SDF's own quick-run
 * guide calls "replace the reference server with your own business
 * callback server implementation."
 *
 * Scope (testnet, this pass): real SEP-1/10/38/31 discovery + quoting +
 * KYC-stub end to end. Full transaction-lifecycle completion (reporting a
 * received SEP-31 payment back to the Platform API via JSON-RPC) is
 * deliberately NOT wired yet — documented as the next step in
 * TECHNICAL.md, not silently half-built.
 */
const config = env();
const logger = createLogger({ service: "anchor-business" });

const stellarClient = new stellar.StellarClient({
  network: config.STELLAR_NETWORK,
  rpcUrl: config.STELLAR_RPC_URL,
  horizonUrl:
    config.STELLAR_NETWORK === "mainnet" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org",
  networkPassphrase:
    config.STELLAR_NETWORK === "mainnet"
      ? "Public Global Stellar Network ; September 2015"
      : "Test SDF Network ; September 2015",
});
const reflector = new ReflectorClient(stellarClient, config.STELLAR_NETWORK, config.REFLECTOR_PRICE_CONTRACT_ID, logger);

const app = express();
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/healthz" } }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

// Every callback route requires the shared secret the `platform` service
// sends as `X-Api-Key` (callback_api.auth.type: api_key in its config) —
// proves the request actually came from our own Anchor Platform instance,
// not an open endpoint anyone could hit to read/write customer records.
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("X-Api-Key");
  if (key !== config.CALLBACK_API_AUTH_SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

app.use(requireApiKey);

app.get("/customer", getCustomerHandler());
app.put("/customer", putCustomerHandler());
app.delete("/customer", deleteCustomerHandler());
app.get("/rate", rateHandler(reflector));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "internal error" });
});

app.listen(config.PORT, "0.0.0.0", () => {
  logger.info({ port: config.PORT, network: config.STELLAR_NETWORK }, "anchor-business listening");
});
