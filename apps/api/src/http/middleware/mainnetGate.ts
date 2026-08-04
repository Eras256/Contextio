import type { NextFunction, Request, Response } from "express";
import { env } from "../../env.js";
import { HttpError, requireCtx } from "../context.js";

/**
 * "Por invitación": on mainnet, self-custody money-moving endpoints (treasury
 * prepare/submit, payroll payout prepare/submit) are further restricted to an
 * explicit tenant allowlist, on top of the normal RBAC capability check. A
 * stand-in for the full KYB/tier gate on the roadmap — this is deliberately
 * simple (an env-configured list) rather than a half-built tier/KYB system.
 * No-op on testnet/local, where the existing capability checks are enough.
 */
export function requireMainnetAllowlist() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const config = env();
    if (config.STELLAR_NETWORK !== "mainnet") {
      next();
      return;
    }
    const ctx = requireCtx(req);
    if (!config.MAINNET_ALLOWLIST_TENANT_IDS.includes(ctx.tenantId)) {
      next(
        new HttpError(
          403,
          "This tenant is not on the mainnet allowlist yet. Mainnet payouts/treasury moves are invitation-only.",
        ),
      );
      return;
    }
    next();
  };
}
