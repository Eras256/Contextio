import type {
  AgentDecision,
  LegalContext,
  LegalState,
  Obligation,
  TreasurySnapshot,
  WalletChallenge,
  WalletSession,
  ProposeOptions,
} from "./types.js";

export interface ContextioClientOptions {
  /** Base URL of the Contextio API, e.g. https://contextio-api.fly.dev */
  baseUrl: string;
  /** Session JWT (from wallet sign-in). Required for tenant-scoped endpoints. */
  accessToken?: string;
  /** Tenant id to scope requests to (sent as x-tenant-id). */
  tenantId?: string;
  /** Custom fetch (defaults to global fetch). */
  fetch?: typeof fetch;
}

/**
 * Typed client for the Contextio API. Use the unauthenticated handshake
 * (`challenge`/`verify`, or the `signInWithStellar` helper) to obtain a session,
 * then `withSession()` to get an authenticated client for tenant-scoped reads.
 */
export class ContextioClient {
  private readonly baseUrl: string;
  private readonly accessToken?: string;
  private readonly tenantId?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ContextioClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.accessToken = options.accessToken;
    this.tenantId = options.tenantId;
    const f = options.fetch ?? globalThis.fetch;
    if (!f) throw new Error("No fetch implementation available; pass options.fetch");
    this.fetchImpl = f;
  }

  /** Return a new client carrying the given session (token + tenant). */
  withSession(session: Pick<WalletSession, "token" | "tenantId">): ContextioClient {
    return new ContextioClient({
      baseUrl: this.baseUrl,
      accessToken: session.token,
      tenantId: session.tenantId,
      fetch: this.fetchImpl,
    });
  }

  // ── Wallet sign-in handshake (no auth) ───────────────────────────────────
  challenge(address: string): Promise<WalletChallenge> {
    return this.request("/auth/wallet/challenge", { method: "POST", body: { address } }, false);
  }

  verify(input: {
    address: string;
    message: string;
    hmac: string;
    signedMessage: string;
  }): Promise<WalletSession> {
    return this.request("/auth/wallet/verify", { method: "POST", body: input }, false);
  }

  // ── Tenant-scoped reads (require a session) ──────────────────────────────
  treasury(): Promise<TreasurySnapshot> {
    return this.request("/treasury");
  }

  obligations(): Promise<Obligation[]> {
    return this.request("/payroll/obligations");
  }

  decisions(): Promise<AgentDecision[]> {
    return this.request("/agent/decisions");
  }

  propose(options: boolean | ProposeOptions = {}): Promise<AgentDecision> {
    const body = typeof options === "boolean" ? { execute: options } : options;
    return this.request("/agent/propose", { method: "POST", body });
  }

  legal(): Promise<LegalState> {
    return this.request("/legal");
  }

  /** Fetch a tenant's public contextio-legal-context.json (served at the API mirror). */
  async wellKnownLegalContext(domain: string): Promise<LegalContext> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/.well-known/contextio-legal-context.json?domain=${encodeURIComponent(domain)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new ContextioApiError(res.status, `.well-known -> ${res.status}`);
    return (await res.json()) as LegalContext;
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: unknown } = {},
    auth = true,
  ): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (auth) {
      if (!this.accessToken || !this.tenantId) {
        throw new Error(`Endpoint ${path} requires a session — call withSession() first`);
      }
      headers.authorization = `Bearer ${this.accessToken}`;
      headers["x-tenant-id"] = this.tenantId;
    }
    const res = await this.fetchImpl(`${this.baseUrl}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      let msg = `API ${path} -> ${res.status}`;
      if (json && typeof json === "object" && "error" in json) {
        msg = String((json as { error: unknown }).error);
      }
      throw new ContextioApiError(res.status, msg);
    }
    return json as T;
  }
}

export class ContextioApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ContextioApiError";
  }
}
