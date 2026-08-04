import { randomUUID } from "node:crypto";
import { Decimal } from "decimal.js";
import type { Request, Response } from "express";
import type { ReflectorClient } from "./reflector.js";

/**
 * GET /rate — the callback the Anchor Platform's SEP-38 endpoints (`/prices`,
 * `/price`) call on us to price a sell/buy asset pair. Exact request/response
 * shapes verified against the real Java models (not guessed):
 * api-schema/src/main/java/org/stellar/anchor/api/callback/{GetRateRequest,
 * GetRateResponse}.java at github.com/stellar/anchor-platform (tag 4.6.2).
 *
 * `price` = how many units of `sell_asset` it costs to obtain 1 unit of
 * `buy_asset` (sell_amount = price * buy_amount + fee) — verified against
 * SDF's own kotlin-reference-server demo price table (the same one that
 * powers testanchor.stellar.org's real, live /prices responses).
 *
 * The platform re-derives `price * buy_amount + fee` from whatever we return
 * (as an exact BigDecimal) and rejects the response if it doesn't reproduce
 * `sell_amount` within `10^-significant_decimals` of the SELL asset
 * (RestRateIntegration.java `withinRoundingError` — 1e-7 for stellar:native's
 * 7 decimals). That's an *absolute* tolerance regardless of amount
 * magnitude, so for a large buy_amount (COP's max is 200M) even a tiny
 * per-unit rounding error in `price` blows past it once multiplied back out
 * — plain `Number`/`toFixed` (~15-17 significant digits of float precision)
 * isn't enough headroom. Decimal.js does exact base-10 arithmetic (same
 * semantics as Java's BigDecimal) so `price` is derived from the two final,
 * already-rounded amounts at 40 significant digits — the round-trip error is
 * effectively zero, not just "small."
 */
Decimal.set({ precision: 40 });

const STELLAR_NATIVE = "stellar:native";

// Must match infra/anchor-platform/*.fly.toml's assets.yaml significant_decimals exactly.
const SIGNIFICANT_DECIMALS: Record<string, number> = {
  "stellar:native": 7,
  "iso4217:USD": 4,
  "iso4217:BRL": 2,
  "iso4217:ARS": 2,
  "iso4217:COP": 2,
};

// LatAm fiat corridors (BRL/ARS/COP) have no confirmed live oracle feed on
// testnet — same limitation Reflector already has, and the same reasoning
// the treasury's FX volatility buffer elsewhere in this codebase is built
// around. These are approximate, manually-set demo rates, not a live feed —
// exactly the same "static demo table" pattern SDF's own reference anchor
// uses for every pair (verified: their table is a hardcoded Kotlin map, not
// a live source either). USD uses the real Reflector oracle price when
// reachable; the others fall back to this table always.
const DEMO_FIAT_PER_XLM: Record<string, number> = {
  "iso4217:USD": 0.17,
  "iso4217:BRL": 0.94,
  "iso4217:ARS": 195,
  "iso4217:COP": 730,
};

interface StoredQuote {
  id: string;
  sellAsset: string;
  sellAmount: string;
  buyAsset: string;
  buyAmount: string;
  price: string;
  expiresAt: string;
  fee: { total: string; asset: string };
}

// In-memory only — a demo anchor's firm quotes don't need to survive a
// restart. (SEP-31 payments referencing an expired/lost quote id after a
// redeploy would need to re-quote; acceptable for a testnet demo.)
const quotes = new Map<string, StoredQuote>();

async function fiatPerXlm(asset: string, reflector: ReflectorClient): Promise<Decimal | null> {
  if (!(asset in DEMO_FIAT_PER_XLM)) return null;
  if (asset === "iso4217:USD") {
    const real = await reflector.getUsdPrice("XLM");
    if (real) return new Decimal(real);
  }
  const fallback = DEMO_FIAT_PER_XLM[asset];
  return fallback === undefined ? null : new Decimal(fallback);
}

/** Raw (full-precision) price = sell_asset units per 1 buy_asset unit. */
async function resolveRawPrice(sellAsset: string, buyAsset: string, reflector: ReflectorClient): Promise<Decimal | null> {
  if (sellAsset === buyAsset) return new Decimal(1);
  if (sellAsset === STELLAR_NATIVE) {
    const perXlm = await fiatPerXlm(buyAsset, reflector);
    return perXlm ? new Decimal(1).dividedBy(perXlm) : null;
  }
  if (buyAsset === STELLAR_NATIVE) {
    return fiatPerXlm(sellAsset, reflector);
  }
  return null;
}

const decimalsOf = (asset: string) => SIGNIFICANT_DECIMALS[asset] ?? 4;

export function rateHandler(reflector: ReflectorClient) {
  return async (req: Request, res: Response) => {
    const type = String(req.query.type ?? "");
    const sellAsset = String(req.query.sell_asset ?? "");
    const buyAsset = String(req.query.buy_asset ?? "");
    const sellAmountQ = req.query.sell_amount ? String(req.query.sell_amount) : undefined;
    const buyAmountQ = req.query.buy_amount ? String(req.query.buy_amount) : undefined;

    if (type !== "indicative" && type !== "firm") {
      res.status(400).json({ error: "type must be either indicative or firm" });
      return;
    }
    if (!sellAsset || !buyAsset) {
      res.status(400).json({ error: "sell_asset and buy_asset must be provided" });
      return;
    }
    if ((!sellAmountQ && !buyAmountQ) || (sellAmountQ && buyAmountQ)) {
      res.status(400).json({ error: "either sell_amount or buy_amount must be provided, not both" });
      return;
    }

    const rawPrice = await resolveRawPrice(sellAsset, buyAsset, reflector);
    if (rawPrice == null) {
      res.status(400).json({ error: `No rate available for ${sellAsset} -> ${buyAsset}` });
      return;
    }

    const feeAmount = new Decimal(0); // no anchor fee on this testnet demo corridor
    const fee = { total: feeAmount.toFixed(4), asset: sellAsset };

    // Provisional amounts from the raw price, then round EACH to its own
    // asset's significant_decimals — these two rounded values are what
    // actually go in the response.
    const sellAmountRaw = sellAmountQ ? new Decimal(sellAmountQ) : new Decimal(buyAmountQ!).times(rawPrice).plus(feeAmount);
    const buyAmountRaw = buyAmountQ ? new Decimal(buyAmountQ) : new Decimal(sellAmountQ!).minus(feeAmount).dividedBy(rawPrice);
    const sellAmount = sellAmountRaw.toFixed(decimalsOf(sellAsset));
    const buyAmount = buyAmountRaw.toFixed(decimalsOf(buyAsset));

    // Re-derive price FROM the two rounded amounts (not the raw price), as
    // an exact decimal division — this is what makes
    // `price * buy_amount + fee == sell_amount` hold regardless of amount
    // magnitude, not just "usually close enough".
    const price = new Decimal(sellAmount).minus(feeAmount).dividedBy(buyAmount).toFixed(30);

    if (type === "indicative") {
      res.json({ rate: { price, sell_amount: sellAmount, buy_amount: buyAmount, fee } });
      return;
    }

    // Firm quote: persisted (in-memory) so the platform can settle against
    // this exact id/price/amount later in the transaction lifecycle.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const quote: StoredQuote = {
      id: randomUUID(),
      sellAsset,
      sellAmount,
      buyAsset,
      buyAmount,
      price,
      expiresAt,
      fee,
    };
    quotes.set(quote.id, quote);
    res.json({
      rate: {
        id: quote.id,
        price: quote.price,
        sell_amount: quote.sellAmount,
        buy_amount: quote.buyAmount,
        expires_at: quote.expiresAt,
        fee,
      },
    });
  };
}

export function getQuote(id: string): StoredQuote | undefined {
  return quotes.get(id);
}
