import {
  Address,
  Asset,
  Contract,
  Horizon,
  Keypair,
  nativeToScVal,
  Operation,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
  BASE_FEE,
  type Account,
} from "@stellar/stellar-sdk";
import { type NetworkConfig } from "./network.js";

/**
 * Thin, opinionated wrapper around @stellar/stellar-sdk's Soroban RPC client.
 * Centralizes the build → simulate/prepare → sign → send → poll lifecycle so
 * callers (treasury/payroll services) never reimplement it. Stellar-specific
 * correctness (network passphrase, fees, auth) is enforced here.
 */
export interface InvokeParams {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  /** Secret seed (S...) of the source account submitting the transaction. */
  sourceSecret: string;
  /** Max fee in stroops; defaults to a generous multiple of BASE_FEE for Soroban. */
  fee?: string;
  /** Poll timeout for transaction confirmation, ms. */
  timeoutMs?: number;
}

export interface InvokeResult {
  txHash: string;
  /** Decoded return value (native JS) when the call returns one. */
  returnValue: unknown;
  ledger: number;
}

export class StellarClient {
  readonly server: rpc.Server;
  readonly config: NetworkConfig;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.server = new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    });
  }

  static address(value: string): Address {
    return Address.fromString(value);
  }

  /** Convenience converters re-exported so callers don't import the SDK directly. */
  static toScVal = nativeToScVal;
  static fromScVal = scValToNative;

  async getAccount(publicKey: string): Promise<Account> {
    return this.server.getAccount(publicKey);
  }

  async getHealth(): Promise<{ status: string; latestLedger?: number }> {
    const health = (await this.server.getHealth()) as { status: string; latestLedger?: number };
    return { status: health.status, latestLedger: health.latestLedger };
  }

  /**
   * Build, simulate/prepare, sign, submit, and confirm a contract invocation.
   * Handles the common Soroban gotchas: footprint + resource fee come from
   * `prepareTransaction` (simulation), and we poll until the tx leaves PENDING.
   */
  async invoke(params: InvokeParams): Promise<InvokeResult> {
    const keypair = Keypair.fromSecret(params.sourceSecret);
    const source = await this.server.getAccount(keypair.publicKey());
    const contract = new Contract(params.contractId);

    const built = new TransactionBuilder(source, {
      fee: params.fee ?? (Number(BASE_FEE) * 100).toString(),
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(params.method, ...(params.args ?? [])))
      .setTimeout(180)
      .build();

    // Simulation attaches the Soroban footprint + resource fees and surfaces
    // MissingValue / auth errors before we ever pay for submission.
    const prepared = await this.server.prepareTransaction(built);
    prepared.sign(keypair);

    const sent = await this.server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      throw new Error(`Stellar submission failed: ${JSON.stringify(sent.errorResult)}`);
    }

    const confirmed = await this.pollTransaction(sent.hash, params.timeoutMs ?? 30_000);
    if (confirmed.status !== "SUCCESS") {
      throw new Error(`Transaction ${sent.hash} did not succeed: ${confirmed.status}`);
    }

    return {
      txHash: sent.hash,
      returnValue: confirmed.returnValue ? scValToNative(confirmed.returnValue) : null,
      ledger: confirmed.ledger,
    };
  }

  /**
   * Submit a pre-built Soroban operation (base-64 XDR) — e.g. one produced by an
   * external protocol SDK like Blend's `PoolContract.submit`. We wrap it in a
   * transaction, let `prepareTransaction` attach the footprint + auth + resource
   * fees, sign with the platform key, submit, and confirm.
   */
  async submitOperationXdr(
    operationXdr: string,
    sourceSecret: string,
    timeoutMs = 30_000,
  ): Promise<InvokeResult> {
    const keypair = Keypair.fromSecret(sourceSecret);
    const source = await this.server.getAccount(keypair.publicKey());
    const op = xdr.Operation.fromXDR(operationXdr, "base64");
    const built = new TransactionBuilder(source, {
      fee: (Number(BASE_FEE) * 100).toString(),
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(180)
      .build();

    const prepared = await this.server.prepareTransaction(built);
    prepared.sign(keypair);

    const sent = await this.server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      throw new Error(`Stellar submission failed: ${JSON.stringify(sent.errorResult)}`);
    }
    const confirmed = await this.pollTransaction(sent.hash, timeoutMs);
    if (confirmed.status !== "SUCCESS") {
      throw new Error(`Transaction ${sent.hash} did not succeed: ${confirmed.status}`);
    }
    return {
      txHash: sent.hash,
      returnValue: confirmed.returnValue ? scValToNative(confirmed.returnValue) : null,
      ledger: confirmed.ledger,
    };
  }

  /**
   * Build (but do NOT sign) a Soroban operation as a prepared transaction for an
   * external source account — the user-signed (self-custody) path. The frontend
   * signs the returned XDR with the user's own wallet (Freighter). We attach the
   * footprint + auth + resource fees via `prepareTransaction`; with the user as
   * the source account, their envelope signature satisfies the contract's
   * source-account auth, so no separate auth-entry signing is needed.
   */
  async buildOperationXdr(operationXdr: string, sourcePublicKey: string): Promise<string> {
    const source = await this.server.getAccount(sourcePublicKey);
    const op = xdr.Operation.fromXDR(operationXdr, "base64");
    const built = new TransactionBuilder(source, {
      fee: (Number(BASE_FEE) * 100).toString(),
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(180)
      .build();
    const prepared = await this.server.prepareTransaction(built);
    return prepared.toXDR();
  }

  /**
   * Build (but do NOT sign) a Soroban contract call for an external source
   * account — the user-signed (self-custody) path for methods we build
   * ourselves (as opposed to `buildOperationXdr`, which wraps an operation XDR
   * handed back by an external protocol SDK like Blend's). `prepareTransaction`
   * attaches the footprint + resource fees; when `sourcePublicKey` matches the
   * contract call's `require_auth()` address, the envelope's own signature
   * satisfies that auth entry — no separate auth-entry signing needed.
   */
  async buildContractCallXdr(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    sourcePublicKey: string,
  ): Promise<string> {
    const source = await this.server.getAccount(sourcePublicKey);
    const contract = new Contract(contractId);
    const built = new TransactionBuilder(source, {
      fee: (Number(BASE_FEE) * 100).toString(),
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(180)
      .build();
    const prepared = await this.server.prepareTransaction(built);
    return prepared.toXDR();
  }

  /**
   * Build (but do NOT sign) a classic multi-operation Payment transaction from
   * an external source account — the self-custody counterpart to
   * `sendPayments`. The caller's own wallet (e.g. a company treasury wallet)
   * must hold the asset being paid out; this never touches a platform-held key.
   */
  async buildPaymentsXdr(
    sourcePublicKey: string,
    payments: { destination: string; assetCode: string; assetIssuer: string; amount: string }[],
  ): Promise<string> {
    const horizon = new Horizon.Server(this.config.horizonUrl);
    const account = await horizon.loadAccount(sourcePublicKey);
    const builder = new TransactionBuilder(account, {
      fee: (Number(BASE_FEE) * Math.max(1, payments.length)).toString(),
      networkPassphrase: this.config.networkPassphrase,
    });
    for (const p of payments) {
      builder.addOperation(
        Operation.payment({
          destination: p.destination,
          asset: new Asset(p.assetCode, p.assetIssuer),
          amount: p.amount,
        }),
      );
    }
    return builder.setTimeout(180).build().toXDR();
  }

  /** Submit an already-signed transaction envelope (base-64 XDR) and confirm. */
  async submitSignedXdr(signedXdr: string, timeoutMs = 30_000): Promise<InvokeResult> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase);
    const sent = await this.server.sendTransaction(tx);
    if (sent.status === "ERROR") {
      throw new Error(`Stellar submission failed: ${JSON.stringify(sent.errorResult)}`);
    }
    const confirmed = await this.pollTransaction(sent.hash, timeoutMs);
    if (confirmed.status !== "SUCCESS") {
      throw new Error(`Transaction ${sent.hash} did not succeed: ${confirmed.status}`);
    }
    return {
      txHash: sent.hash,
      returnValue: confirmed.returnValue ? scValToNative(confirmed.returnValue) : null,
      ledger: confirmed.ledger,
    };
  }

  /**
   * Send one or more classic asset payments in a single transaction via Horizon
   * (used for real payroll payouts — e.g. USDC to each employee's wallet).
   * `amount` is a decimal string (e.g. "45.0000000"). Returns the tx hash.
   */
  async sendPayments(
    sourceSecret: string,
    payments: { destination: string; assetCode: string; assetIssuer: string; amount: string }[],
  ): Promise<{ txHash: string }> {
    const horizon = new Horizon.Server(this.config.horizonUrl);
    const keypair = Keypair.fromSecret(sourceSecret);
    const account = await horizon.loadAccount(keypair.publicKey());
    const builder = new TransactionBuilder(account, {
      fee: (Number(BASE_FEE) * Math.max(1, payments.length)).toString(),
      networkPassphrase: this.config.networkPassphrase,
    });
    for (const p of payments) {
      builder.addOperation(
        Operation.payment({
          destination: p.destination,
          asset: new Asset(p.assetCode, p.assetIssuer),
          amount: p.amount,
        }),
      );
    }
    const tx = builder.setTimeout(60).build();
    tx.sign(keypair);
    const res = await horizon.submitTransaction(tx);
    return { txHash: res.hash };
  }

  /**
   * Read an account's classic balances from Horizon (native XLM + credit assets).
   * Used to surface the treasury wallet's REAL on-chain holdings on the dashboard.
   */
  async getBalances(
    account: string,
  ): Promise<{ assetType: string; assetCode: string | null; assetIssuer: string | null; balance: string }[]> {
    const horizon = new Horizon.Server(this.config.horizonUrl);
    const acc = await horizon.loadAccount(account);
    return acc.balances.map((b) => ({
      assetType: b.asset_type,
      assetCode: b.asset_type === "native" ? "XLM" : "asset_code" in b ? b.asset_code : null,
      assetIssuer: "asset_issuer" in b ? b.asset_issuer : null,
      balance: b.balance,
    }));
  }

  /**
   * Read-only invocation via simulation only — no fees, no submission. Use for
   * view methods (balances, positions) where a ledger write isn't required.
   */
  async simulate(params: Omit<InvokeParams, "sourceSecret" | "fee">): Promise<unknown> {
    // A throwaway account is fine for read-only simulation.
    const probe = Keypair.random();
    const source = new (await import("@stellar/stellar-sdk")).Account(probe.publicKey(), "0");
    const contract = new Contract(params.contractId);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(params.method, ...(params.args ?? [])))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation error: ${sim.error}`);
    }
    const retval = sim.result?.retval;
    return retval ? scValToNative(retval) : null;
  }

  private async pollTransaction(
    hash: string,
    timeoutMs: number,
  ): Promise<rpc.Api.GetTransactionResponse & { ledger: number; returnValue?: xdr.ScVal }> {
    const deadline = Date.now() + timeoutMs;
    // Exponential-ish backoff bounded by the deadline.
    let delay = 500;
    for (;;) {
      const res = await this.server.getTransaction(hash);
      if (res.status !== "NOT_FOUND") {
        return res as never;
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for transaction ${hash}`);
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 4_000);
    }
  }

  /**
   * Stream recent contract events. Soroban RPC retains ~7 days of events; for
   * longer history the worker should persist them into Supabase as they arrive.
   */
  async getContractEvents(
    contractId: string,
    startLedger: number,
    limit = 100,
  ): Promise<rpc.Api.EventResponse[]> {
    const res = await this.server.getEvents({
      startLedger,
      filters: [{ type: "contract", contractIds: [contractId] }],
      limit,
    });
    return res.events;
  }
}

export { xdr, nativeToScVal, scValToNative, Address, Keypair };

/**
 * Sign a base-64 transaction envelope XDR with a Stellar secret and return the
 * signed envelope XDR. Used for integrations (e.g. DeFindex) whose API returns
 * an unsigned transaction we must sign locally and hand back for submission.
 * Pure offline signing — no RPC needed.
 */
export function signEnvelopeXdr(
  envelopeXdr: string,
  secret: string,
  networkPassphrase: string,
): string {
  const tx = TransactionBuilder.fromXDR(envelopeXdr, networkPassphrase);
  tx.sign(Keypair.fromSecret(secret));
  return tx.toXDR();
}
