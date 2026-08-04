import { type Logger, stellar } from "@contextio/shared";

export interface AnchorConfig {
  /** Anchor home domain base URL (serves /.well-known/stellar.toml). */
  sep24Url: string;
  /** Key that proves account control in SEP-10 (the treasury/agent wallet). */
  signerSecret?: string;
  networkPassphrase: string;
}

/**
 * Light SEP-24 off-ramp client. Performs the REAL anchor handshake on testnet:
 * SEP-10 web-auth (challenge → sign → JWT) then a SEP-24 interactive withdraw,
 * returning the anchor's hosted off-ramp URL. This is the genuine mechanism that,
 * with a licensed anchor in production, settles to local rails (PIX / Bre-B /
 * Transferencias 3.0). On testnet the fiat leg is simulated by the anchor.
 */
export class AnchorClient {
  private readonly base: string;

  constructor(
    private readonly config: AnchorConfig,
    private readonly logger: Logger,
  ) {
    this.base = config.sep24Url.replace(/\/$/, "");
  }

  /** True when we can sign the SEP-10 challenge (a signer key is configured). */
  get live(): boolean {
    return Boolean(this.config.signerSecret);
  }

  private async endpoints(signal: AbortSignal): Promise<{ transferServer: string; webAuth: string }> {
    const toml = await (await fetch(`${this.base}/.well-known/stellar.toml`, { signal })).text();
    const g = (k: string) => toml.match(new RegExp(`${k}\\s*=\\s*"([^"]+)"`))?.[1];
    const transferServer = g("TRANSFER_SERVER_SEP0024");
    const webAuth = g("WEB_AUTH_ENDPOINT");
    if (!transferServer || !webAuth) throw new Error("Anchor missing SEP-24/SEP-10 endpoints");
    return { transferServer: transferServer.replace(/\/$/, ""), webAuth };
  }

  /**
   * Real SEP-1 lookup for the SEP-31 (institutional send) and SEP-38 (anchor
   * quote) server URLs, alongside the SEP-24/10 ones above. Same anchor, same
   * `.well-known/stellar.toml` — SDF's public reference anchor publishes both.
   */
  private async sep3138Endpoints(signal: AbortSignal): Promise<{ quoteServer: string | null; directPayment: string | null }> {
    const toml = await (await fetch(`${this.base}/.well-known/stellar.toml`, { signal })).text();
    const g = (k: string) => toml.match(new RegExp(`${k}\\s*=\\s*"([^"]+)"`))?.[1] ?? null;
    return {
      quoteServer: g("ANCHOR_QUOTE_SERVER")?.replace(/\/$/, "") ?? null,
      directPayment: g("DIRECT_PAYMENT_SERVER")?.replace(/\/$/, "") ?? null,
    };
  }

  /**
   * SEP-38 indicative price — no auth required by spec for `GET /prices`.
   * This is what a firm FX quote before a SEP-31 settlement is built on; the
   * reference anchor only prices USDC/XLM/SRT against iso4217:USD and
   * iso4217:CAD today (no BRL/ARS/COP), same limitation Reflector already has
   * for LATAM fiat pairs — real integration, upstream-limited coverage.
   */
  async getSep38Prices(sellAsset: string, sellAmount: string): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const { quoteServer } = await this.sep3138Endpoints(ctrl.signal);
      if (!quoteServer) throw new Error("Anchor does not publish a SEP-38 quote server");
      const url = `${quoteServer}/prices?sell_asset=${encodeURIComponent(sellAsset)}&sell_amount=${encodeURIComponent(sellAmount)}`;
      const res = await fetch(url, { signal: ctrl.signal });
      const body = await res.json();
      if (!res.ok) throw new Error(`SEP-38 prices failed: ${JSON.stringify(body)}`);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * SEP-31 capabilities — which assets this anchor accepts for institutional
   * cross-border send, and whether it requires/supports a SEP-38 quote first.
   * Read-only discovery call, no auth, no funds moved.
   */
  async getSep31Info(): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const { directPayment } = await this.sep3138Endpoints(ctrl.signal);
      if (!directPayment) throw new Error("Anchor does not publish a SEP-31 direct payment server");
      const res = await fetch(`${directPayment}/info`, { signal: ctrl.signal });
      const body = await res.json();
      if (!res.ok) throw new Error(`SEP-31 info failed: ${JSON.stringify(body)}`);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Real SEP-10 auth + SEP-24 interactive withdraw → the anchor's hosted off-ramp
   * URL (KYC + amount happen on the anchor's page). Throws with the anchor's
   * reason on any failure.
   */
  async initiateWithdraw(assetCode = "USDC"): Promise<{ url: string; id: string; account: string; anchor: string }> {
    if (!this.config.signerSecret) throw new Error("Off-ramp needs a configured signer key");
    const account = stellar.Keypair.fromSecret(this.config.signerSecret).publicKey();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const { transferServer, webAuth } = await this.endpoints(ctrl.signal);

      // ── SEP-10: prove control of `account` and get a JWT ──────────────────
      const challenge = (await (
        await fetch(`${webAuth}?account=${account}`, { signal: ctrl.signal })
      ).json()) as { transaction?: string; network_passphrase?: string };
      if (!challenge.transaction) throw new Error("SEP-10 challenge missing");
      const signed = stellar.signEnvelopeXdr(
        challenge.transaction,
        this.config.signerSecret,
        challenge.network_passphrase ?? this.config.networkPassphrase,
      );
      const tokenRes = (await (
        await fetch(webAuth, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transaction: signed }),
          signal: ctrl.signal,
        })
      ).json()) as { token?: string; error?: string };
      if (!tokenRes.token) throw new Error(`SEP-10 auth failed: ${tokenRes.error ?? "no token"}`);

      // ── SEP-24: start an interactive withdraw ─────────────────────────────
      const wRes = (await (
        await fetch(`${transferServer}/transactions/withdraw/interactive`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${tokenRes.token}` },
          body: JSON.stringify({ asset_code: assetCode, account }),
          signal: ctrl.signal,
        })
      ).json()) as { url?: string; id?: string; error?: string };
      if (!wRes.url || !wRes.id) throw new Error(`Anchor withdraw failed: ${wRes.error ?? JSON.stringify(wRes)}`);

      this.logger.info({ account: `${account.slice(0, 5)}…`, id: wRes.id }, "SEP-24 off-ramp initiated");
      return { url: wRes.url, id: wRes.id, account, anchor: this.base.replace(/^https?:\/\//, "") };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new Error("Anchor off-ramp timed out");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
}
