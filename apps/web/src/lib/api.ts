/**
 * Typed client for the Contextio API. Components pass a Supabase access token +
 * tenant id (from the auth context). The API verifies the token (JWKS/HS256),
 * checks tenant membership, and enforces RBAC + the Legal Context Protocol.
 */
import { resolveApiUrl } from "./network";

export interface ApiAuth {
  accessToken: string;
  tenantId: string;
}

export interface TreasurySnapshot {
  config: {
    minLiquidityBaseUnits: string;
    maxYieldBps: number;
    volatilitySensitivity: number;
    countryLimitsBps: Record<string, number>;
    agentEnabled: boolean;
  } | null;
  positions: {
    asset: string;
    strategy: "liquidity" | "defindex_vault" | "blend_pool";
    strategyRef: string | null;
    amountBaseUnits: string;
    apyBps: number | null;
  }[];
  totals: {
    liquidBaseUnits: string;
    yieldBaseUnits: string;
    totalBaseUnits: string;
    yieldShareBps: number;
  };
}

export interface Obligation {
  scheduleId: string;
  scheduleName: string;
  nextRunAt: string;
  asset: string;
  requiredBaseUnits: string;
  employeeCount?: number;
}

export interface PayrollEmployee {
  id: string;
  fullName: string;
  email: string | null;
  country: string;
  payoutAsset: string;
  preferredRail: string;
  salaryAmount: string;
  active: boolean;
}

export interface PayrollRun {
  id: string;
  scheduleId: string;
  status: "simulated" | "executing" | "completed" | "failed";
  totalAmount: string;
  asset: string;
  legalContextHash: string | null;
  stellarTxHash: string | null;
  executedAt: string | null;
  createdAt: string;
  lines?: { fullName?: string; destination: string; amount: string }[];
}

export interface Decision {
  id: string;
  action: string;
  rationale: string;
  status: string;
  legalContextHash: string | null;
  stellarTxHash: string | null;
  createdAt: string;
  /** Present when a proposal was made but couldn't settle this cycle. */
  executionError?: string;
}

export interface LegalState {
  published: boolean;
  hash?: string;
  document?: Record<string, unknown>;
}

async function request<T>(path: string, auth: ApiAuth, init?: RequestInit): Promise<T> {
  const res = await fetch(`${resolveApiUrl()}/api/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth.accessToken}`,
      "x-tenant-id": auth.tenantId,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    // Surface the API's real reason (the generic 500 handler hides it, but our
    // operational routes return { error } / { message }).
    let detail = `${res.status}`;
    try {
      const j = (await res.json()) as { error?: string; message?: string; issues?: { message: string }[] };
      detail = j.error || j.message || j.issues?.map((i) => i.message).join("; ") || detail;
    } catch {
      /* non-JSON body */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  treasury: (auth: ApiAuth) => request<TreasurySnapshot>("/treasury", auth),
  obligations: (auth: ApiAuth) => request<Obligation[]>("/payroll/obligations", auth),
  employees: (auth: ApiAuth) => request<PayrollEmployee[]>("/payroll/employees", auth),
  runs: (auth: ApiAuth) => request<PayrollRun[]>("/payroll/runs", auth),
  /** Execute a real payroll run for a schedule (settles USDC on-chain). */
  runPayroll: (auth: ApiAuth, scheduleId: string) =>
    request<PayrollRun>("/payroll/runs", auth, { method: "POST", body: JSON.stringify({ scheduleId }) }),

  /**
   * Self-custody Payouts (contractors, not employees — never "payroll" in this
   * flow's copy). Step 1: build unsigned XDR(s) for the caller's own treasury
   * wallet to sign. Requires this tenant to be on MAINNET_ALLOWLIST_TENANT_IDS
   * when the API is mainnet-scoped.
   */
  preparePayout: (
    auth: ApiAuth,
    body: {
      scheduleId: string;
      address: string;
      contractorAttestation: true;
      acknowledgeTerms: true;
      jurisdictionAttestation: true;
    },
  ) =>
    request<{
      runId: string;
      paymentXdr: string | null;
      executeRunXdr: string | null;
      totalAmount: string;
      asset: string;
      legalContextId: string;
      legalContextHash: string;
    }>("/payroll/runs/prepare", auth, { method: "POST", body: JSON.stringify(body) }),

  /** Step 2: submit the user-signed envelope(s) from preparePayout. */
  submitPayout: (
    auth: ApiAuth,
    body: {
      runId: string;
      scheduleId: string;
      legalContextId: string;
      legalContextHash: string;
      signedExecuteRunXdr: string | null;
      signedPaymentXdr: string | null;
    },
  ) => request<PayrollRun>("/payroll/runs/submit", auth, { method: "POST", body: JSON.stringify(body) }),
  decisions: (auth: ApiAuth) => request<Decision[]>("/agent/decisions", auth),
  legal: (auth: ApiAuth) => request<LegalState>("/legal", auth),
  propose: (
    auth: ApiAuth,
    execute: boolean,
    ai?: { provider?: string; model?: string; apiKey?: string },
    locale?: string,
  ) =>
    request<Decision>("/agent/propose", auth, {
      method: "POST",
      body: JSON.stringify({
        execute,
        ...(ai?.provider ? { aiProvider: ai.provider } : {}),
        ...(ai?.model ? { aiModel: ai.model } : {}),
        ...(ai?.apiKey ? { aiApiKey: ai.apiKey } : {}),
        ...(locale ? { locale } : {}),
      }),
    }),

  // ── Manual treasury controls (dashboard) ──────────────────────────────────
  /** Persist the risk config (min liquidity, max-yield %, FX sensitivity). */
  saveConfig: (
    auth: ApiAuth,
    cfg: {
      minLiquidityBaseUnits: string;
      maxYieldBps: number;
      volatilitySensitivity: number;
      countryLimitsBps?: Record<string, number>;
      agentEnabled?: boolean;
    },
  ) => request<unknown>("/treasury/config", auth, { method: "PUT", body: JSON.stringify(cfg) }),

  /** Move capital between liquidity and a yield venue — real on-chain rebalance. */
  rebalance: (
    auth: ApiAuth,
    move: {
      from: "liquidity" | "defindex_vault" | "blend_pool";
      to: "liquidity" | "defindex_vault" | "blend_pool";
      asset: string;
      amountBaseUnits: string;
      strategyRef: string;
    },
  ) => request<{ txHash: string; legalContextHash: string }>("/treasury/rebalance", auth, {
    method: "POST",
    body: JSON.stringify(move),
  }),

  /** Activate / deactivate the autonomous agent — gated by a SEP-53 wallet signature. */
  toggleAgent: (
    auth: ApiAuth,
    enabled: boolean,
    consent: { address: string; message: string; signedMessage: string },
  ) =>
    request<{ agentEnabled: boolean }>("/treasury/agent", auth, {
      method: "POST",
      body: JSON.stringify({ enabled, ...consent }),
    }),

  /** Step 1 of a self-custody move: get an unsigned tx for the user to sign. */
  prepareMove: (
    auth: ApiAuth,
    body: {
      venue: "blend" | "defindex";
      direction: "supply" | "withdraw";
      asset: "XLM" | "USDC";
      amountBaseUnits: string;
      address: string;
      acknowledgeTerms: true;
      jurisdictionAttestation: true;
    },
  ) => request<{ xdr: string }>("/treasury/prepare", auth, { method: "POST", body: JSON.stringify(body) }),

  /** Step 2: submit the user-signed envelope. `returnValue` carries the contract's
   *  native return (e.g. the new vault address for a factory create-vault). */
  submitMove: (auth: ApiAuth, signedXdr: string) =>
    request<{ txHash: string; legalContextHash: string; returnValue?: unknown }>("/treasury/submit", auth, {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),

  /** Step 1: build an unsigned factory create-vault tx for the user to sign (self-custody deploy). */
  prepareCreateVault: (auth: ApiAuth, body: { asset: "XLM" | "USDC"; name: string; address: string }) =>
    request<{ xdr: string }>("/integrations/defindex/vaults/prepare", auth, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Build an unsigned tx to renounce control of a vault (manager → null), user-signed. */
  prepareRenounceVault: (auth: ApiAuth, body: { vaultAddress: string; address: string }) =>
    request<{ xdr: string }>("/integrations/defindex/vaults/renounce/prepare", auth, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

/** Live status of the LLM powering the agent's reasoning (public, no auth). */
export interface AiStatus {
  live: boolean;
  provider: string;
  model: string | null;
}

export async function fetchAiStatus(): Promise<AiStatus> {
  const off: AiStatus = { live: false, provider: "none", model: null };
  try {
    const res = await fetch(`${resolveApiUrl()}/api/v1/public/ai`, { cache: "no-store" });
    if (!res.ok) return off;
    return (await res.json()) as AiStatus;
  } catch {
    // API unreachable (down / CORS / offline) — degrade gracefully, never crash.
    return off;
  }
}

async function requestPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${resolveApiUrl()}/api/v1/public${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

/**
 * No-auth reads of the same demo tenant the Home live feed already shows
 * (see apps/api/src/http/routes/public.ts). Lets /treasury, /payroll, and
 * /agent render real data before a visitor connects a wallet, instead of a
 * full-page connect gate. Never used for anything that writes.
 */
export const publicApi = {
  treasury: () => requestPublic<TreasurySnapshot>("/treasury"),
  payroll: () =>
    requestPublic<{ employees: PayrollEmployee[]; obligations: Obligation[]; runs: PayrollRun[] }>("/payroll"),
  employees: () => publicApi.payroll().then((r) => r.employees),
  obligations: () => publicApi.payroll().then((r) => r.obligations),
  runs: () => publicApi.payroll().then((r) => r.runs),
  decisions: () =>
    requestPublic<{ decisions: Decision[] }>("/activity").then((r) => r.decisions),
  legal: () => requestPublic<LegalState>("/legal"),
};

export const apiBaseUrl = resolveApiUrl;

// ── Wallet sign-in handshake (no bearer) ───────────────────────────────────
export interface WalletChallenge {
  message: string;
  hmac: string;
}

export interface WalletSession {
  token: string;
  tokenType: "Bearer";
  expiresAt: string;
  address: string;
  userId: string;
  tenantId: string;
  role: string;
}

async function postPublic<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${resolveApiUrl()}/api/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as string) ?? `API ${path} -> ${res.status}`);
  return json as T;
}

export const authApi = {
  challenge: (address: string) =>
    postPublic<WalletChallenge>("/auth/wallet/challenge", { address }),
  verify: (input: { address: string; message: string; hmac: string; signedMessage: string }) =>
    postPublic<WalletSession>("/auth/wallet/verify", input),
};
