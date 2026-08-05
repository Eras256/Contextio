import type { Logger } from "@contextio/shared";

/**
 * BlindPay integration — off-ramp settlement for the licensed-partner side of
 * Milestone 2 (see TECHNICAL.md §6). Unset by default: this client is inert
 * (`enabled === false`) until a real sandbox/production API key exists, same
 * pattern as `RelayerClient`. No mock fallback — unlike Blend/DeFindex, this
 * isn't part of the live demo loop yet, it's prep work for a real off-ramp
 * that doesn't exist until a human signs up.
 *
 * Researched directly against BlindPay's own docs/changelog (2026-08-05), not
 * assumed:
 * - Stellar support shipped May 2025, actively maintained (a wallet-rotation
 *   fix May 2026; SEPA payouts extended to accept Stellar-USDC June 2026).
 * - The Stellar payout flow is UNSIGNED-XDR: `authorizeStellarPayout` returns
 *   an unsigned transaction that the caller's own wallet signs — BlindPay
 *   never custodies the crypto leg, matching Contextio's non-custodial model.
 * - A free `development` instance is available immediately on sign-up
 *   (https://app.blindpay.com/sign-up), no paid plan or business
 *   verification required first.
 *
 * **Endpoint paths marked CONFIRMED below were found in BlindPay's own docs;
 * paths marked INFERRED are a best guess from naming convention and REST
 * examples in secondary sources, not fetched from BlindPay's raw API
 * reference directly (it didn't render via automated fetching). Validate
 * every INFERRED path against a real sandbox instance before trusting it in
 * a real flow — this client has never been run against BlindPay's actual
 * API.**
 *
 * BlindPay docs: https://blindpay.com/docs/introduction
 */
export interface BlindPayConfig {
  apiUrl?: string;
  /** Unset by default — sign up at https://app.blindpay.com/sign-up (free `development` instance, ready immediately). */
  apiKey?: string;
  /** BlindPay "instance" id (sandbox `development` or `production`) the API key is scoped to. */
  instanceId?: string;
}

export type BlindPayRail = "pix" | "spei" | "ach_co" | "transfers_ar" | "sepa" | "international_swift";

export interface PayoutQuote {
  quoteId: string;
  /** Locked exchange rate for this quote. */
  rate: string;
  /** Stablecoin amount the sender wallet will need to hold/send. */
  sendAmount: string;
  /** Fiat amount the receiver gets. */
  receiveAmount: string;
  /** Quotes are short-lived — confirmed 5 minutes in BlindPay's docs. */
  expiresAt: string;
}

export class BlindPayClient {
  constructor(
    private readonly config: BlindPayConfig,
    private readonly logger: Logger,
  ) {
    if (!config.apiKey) {
      this.logger.warn("BLINDPAY_API_KEY not set — off-ramp settlement via BlindPay is disabled");
    }
  }

  get enabled(): boolean {
    return Boolean(this.config.apiKey && this.config.instanceId);
  }

  private get baseUrl(): string {
    return this.config.apiUrl ?? "https://api.blindpay.com/v1";
  }

  /**
   * Lock a rate + fee for a stablecoin -> fiat payout. INFERRED path — the
   * real quote-creation endpoint wasn't directly confirmed, only that a
   * "create payout quote" step precedes `authorizeStellarPayout` and expires
   * in 5 minutes. Validate against a real sandbox before use.
   */
  async createPayoutQuote(params: {
    receiverId: string;
    rail: BlindPayRail;
    /** Base-units amount of the stablecoin being sent (e.g. USDC, 7-decimal Stellar convention). */
    sendAmountBaseUnits: string;
    currency: string;
  }): Promise<PayoutQuote> {
    if (!this.enabled) throw new Error("BlindPay not configured (BLINDPAY_API_KEY/BLINDPAY_INSTANCE_ID unset)");
    const body = await this.request<{
      id: string;
      rate: string;
      sender_amount: string;
      receiver_amount: string;
      expires_at: string;
    }>("POST", "/quotes/payout", {
      receiver_id: params.receiverId,
      rail: params.rail,
      sender_amount: params.sendAmountBaseUnits,
      currency: params.currency,
      network: "stellar",
    });
    return {
      quoteId: body.id,
      rate: body.rate,
      sendAmount: body.sender_amount,
      receiveAmount: body.receiver_amount,
      expiresAt: body.expires_at,
    };
  }

  /**
   * CONFIRMED path: `POST /instances/{instanceId}/payouts/stellar/authorize`
   * returns an unsigned Stellar transaction XDR for `senderWalletAddress` to
   * sign — BlindPay never touches the crypto leg's custody. The caller signs
   * this with their own wallet (Freighter, or the agent's operational key via
   * the existing `signEnvelopeXdr` helper), then hands the signed XDR to
   * `executeStellarPayout`.
   */
  async authorizeStellarPayout(quoteId: string, senderWalletAddress: string): Promise<{ unsignedXdr: string }> {
    if (!this.enabled) throw new Error("BlindPay not configured (BLINDPAY_API_KEY/BLINDPAY_INSTANCE_ID unset)");
    const body = await this.request<{ transaction_xdr: string }>(
      "POST",
      `/instances/${this.config.instanceId}/payouts/stellar/authorize`,
      { quote_id: quoteId, sender_wallet_address: senderWalletAddress },
    );
    return { unsignedXdr: body.transaction_xdr };
  }

  /**
   * CONFIRMED path: `POST /instances/{instanceId}/payouts/stellar` executes
   * the payout using the signed envelope from `authorizeStellarPayout`.
   */
  async executeStellarPayout(quoteId: string, signedXdr: string): Promise<{ txHash: string }> {
    if (!this.enabled) throw new Error("BlindPay not configured (BLINDPAY_API_KEY/BLINDPAY_INSTANCE_ID unset)");
    const body = await this.request<{ transaction_hash: string }>(
      "POST",
      `/instances/${this.config.instanceId}/payouts/stellar`,
      { quote_id: quoteId, signed_transaction_xdr: signedXdr },
    );
    return { txHash: body.transaction_hash };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`BlindPay ${method} ${path} -> ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
