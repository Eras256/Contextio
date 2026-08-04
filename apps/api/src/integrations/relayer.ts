import { ChannelsClient } from "@openzeppelin/relayer-plugin-channels";
import type { Logger } from "@contextio/shared";

export interface RelayerConfig {
  /** Unset by default. Get one at https://channels.openzeppelin.com/gen (mainnet) or /testnet/gen. */
  apiKey?: string;
  baseUrl: string;
}

/**
 * Fee-sponsored submission via OpenZeppelin's hosted Channels service
 * (channels.openzeppelin.com). The fee-sponsor key lives entirely on
 * OpenZeppelin's infrastructure — we hand it an already fully-signed classic
 * transaction envelope, and it wraps that in a fee-bump paid from its own
 * fund account before broadcasting. It never sees, and could never move, the
 * funds the inner transaction actually moves — that authorization is the
 * client's own signature, same as every other self-custody flow here.
 *
 * This is the one third-party integration that can run on the mainnet
 * deployment without reopening the "no signer secret" boot guard: no key of
 * ours is involved at any point. Scoped to classic transactions only
 * (Payouts' payment XDR) — the Soroban func/auth submission path isn't
 * needed here since `execute_run` only ever runs on testnet, where fee
 * sponsorship isn't required (the agent wallet already holds testnet XLM).
 */
export class RelayerClient {
  private readonly client: ChannelsClient | null;

  constructor(config: RelayerConfig, private readonly logger: Logger) {
    this.client = config.apiKey ? new ChannelsClient({ baseUrl: config.baseUrl, apiKey: config.apiKey }) : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Submit an already fully-signed classic transaction envelope; the service's fund account pays the fee. */
  async submitSponsored(signedXdr: string): Promise<{ txHash: string }> {
    if (!this.client) throw new Error("Relayer not configured (OZ_CHANNELS_API_KEY unset)");
    const res = await this.client.submitTransaction({ xdr: signedXdr });
    if (!res.hash) {
      throw new Error(`Sponsored submission did not confirm a hash (status: ${res.status ?? "unknown"})`);
    }
    this.logger.info(
      { transactionId: res.transactionId, hash: res.hash, status: res.status },
      "Submitted via OpenZeppelin Channels (fee-sponsored, no platform key involved)",
    );
    return { txHash: res.hash };
  }
}
