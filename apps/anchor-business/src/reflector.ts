import { stellar, type Logger } from "@contextio/shared";

/**
 * Public Reflector "external CEX/DEX" price oracle (SEP-40), base = USD.
 * Same client apps/api/src/integrations/reflector.ts uses — copied rather
 * than imported (apps/api doesn't export it as a package) since this
 * service only needs the one read-only method, and duplicating ~60 lines
 * is lower-risk than refactoring a working, already-deployed integration
 * mid-session.
 */
const DEFAULT_PRICE_ORACLE: Record<string, string> = {
  testnet: "CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63",
  mainnet: "CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN",
};

export class ReflectorClient {
  private readonly contractId: string;
  private decimalsCache: number | null = null;

  constructor(
    private readonly stellarClient: stellar.StellarClient,
    network: string,
    priceOracleId: string | undefined,
    private readonly logger: Logger,
  ) {
    this.contractId =
      priceOracleId || DEFAULT_PRICE_ORACLE[network] || DEFAULT_PRICE_ORACLE.testnet || "";
  }

  private async decimals(): Promise<number> {
    if (this.decimalsCache !== null) return this.decimalsCache;
    try {
      const d = await this.stellarClient.simulate({ contractId: this.contractId, method: "decimals" });
      this.decimalsCache = typeof d === "number" && d > 0 ? d : 14;
    } catch {
      this.decimalsCache = 14;
    }
    return this.decimalsCache;
  }

  /** USD price of a ticker (e.g. "XLM") from the external oracle, or null. */
  async getUsdPrice(symbol: string): Promise<number | null> {
    try {
      const asset = stellar.xdr.ScVal.scvVec([
        stellar.nativeToScVal("Other", { type: "symbol" }),
        stellar.nativeToScVal(symbol, { type: "symbol" }),
      ]);
      const res = (await this.stellarClient.simulate({
        contractId: this.contractId,
        method: "lastprice",
        args: [asset],
      })) as { price?: bigint | string | number } | null;
      if (!res || res.price == null) return null;
      const decimals = await this.decimals();
      const price = Number(BigInt(res.price as bigint)) / 10 ** decimals;
      return Number.isFinite(price) && price > 0 ? price : null;
    } catch (e) {
      this.logger.warn({ err: String(e), symbol }, "Reflector price read failed; using fallback");
      return null;
    }
  }
}
