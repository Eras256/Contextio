import { type Logger, type Result, err, tryAsync, stellar } from "@contextio/shared";
import { createBlendMock, type BlendMock, type BlendPosition } from "@contextio/tests/mocks";
import { PoolV2, PoolContractV2, RequestType } from "@blend-capital/blend-sdk";

/**
 * Blend Protocol integration (lending). Blend has no hosted API — it's fully
 * on-chain. When a pool id + signer are configured we read live pool state with
 * the Blend SDK (`PoolV2.load`) and supply/withdraw by building the pool
 * `submit` operation (SDK) then signing + submitting it through our Soroban
 * RPC client. Without a pool id we fall back to the deterministic mock.
 *
 * Blend docs: https://docs.blend.capital
 */
const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

export interface BlendConfig {
  poolId?: string;
  oracleId?: string;
  backstopId?: string;
  /** Underlying asset to supply (defaults to native XLM SAC — no faucet needed). */
  asset?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  /** Platform Stellar secret that signs supply/withdraw transactions. */
  signerSecret?: string;
  /**
   * OpenZeppelin Stellar Smart Account gating Blend supply/withdraw
   * (Milestone 1, see TECHNICAL.md §6) — when set, `submitRequest` routes
   * through `StellarClient.invokeViaSmartAccount` instead of signing
   * directly: `signerSecret`'s key becomes the `Signer::Delegated` that
   * authorizes the call, bounded by the account's on-chain spending-limit
   * policy, and the Blend POSITION itself is held by this address, not the
   * signer's own classic account. Unset by default — the direct-signing
   * path (unchanged) is what runs until this is explicitly configured.
   */
  smartAccountId?: string;
  /** Context rule id on `smartAccountId` scoped to `asset` (carries the real cap). */
  smartAccountAssetRuleId?: number;
  /** Context rule id on `smartAccountId` scoped to `poolId` (signer-gate only). */
  smartAccountPoolRuleId?: number;
}

/** UI-facing snapshot of the live Blend pool reserve + the platform's position. */
export interface BlendVaultData {
  poolId: string;
  asset: string;
  supplyApyBps: number;
  tvlBaseUnits: string;
  positionBaseUnits: string;
  network: string;
}

export class BlendClient {
  private readonly mock: BlendMock | null;
  private readonly signerAddress: string | null;

  constructor(
    private readonly config: BlendConfig,
    private readonly stellarClient: stellar.StellarClient,
    private readonly logger: Logger,
  ) {
    this.mock = config.poolId ? null : createBlendMock();
    this.signerAddress = config.signerSecret
      ? stellar.Keypair.fromSecret(config.signerSecret).publicKey()
      : null;
    if (this.mock) {
      this.logger.warn("BLEND_POOL_CONTRACT_ID not set — using in-memory Blend mock");
    } else if (config.smartAccountId) {
      this.logger.info(
        { smartAccountId: config.smartAccountId },
        "Blend supply/withdraw gated by smart account (Milestone 1) — not signing directly",
      );
    } else if (!this.signerAddress) {
      this.logger.warn("Blend pool set but signer missing — writes disabled, reads only");
    }
  }

  get live(): boolean {
    return this.mock === null;
  }

  get canWrite(): boolean {
    return this.live && !!this.config.signerSecret && !!this.signerAddress;
  }

  get poolId(): string {
    return this.config.poolId ?? "blend_pool_main";
  }

  /**
   * The address that actually HOLDS the Blend position — the smart account
   * when Milestone 1 gating is configured (funds live under its own
   * address, distinct from the signer's classic account), otherwise the
   * signer's own classic address (today's direct-signing behavior).
   */
  private get positionHolderAddress(): string | null {
    return this.config.smartAccountId ?? this.signerAddress;
  }

  private get assetId(): string {
    return this.config.asset ?? XLM_SAC;
  }

  private resolveAssetAddress(asset: string): string {
    if (!asset) return this.assetId;
    if (asset === "XLM") return XLM_SAC;
    if (asset === "USDC") return this.config.asset ?? "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU";
    return asset;
  }

  private get net(): { rpc: string; passphrase: string } {
    return {
      rpc: this.config.rpcUrl ?? "https://soroban-testnet.stellar.org",
      passphrase: this.config.networkPassphrase ?? "Test SDF Network ; September 2015",
    };
  }

  async getPosition(asset: string): Promise<Result<BlendPosition>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.getPosition(this.poolId, asset));
    }
    return tryAsync(async () => {
      const resolvedAsset = this.resolveAssetAddress(asset);
      const d = await this.loadVault(resolvedAsset);
      return {
        poolId: this.poolId,
        asset: resolvedAsset,
        suppliedBaseUnits: d.positionBaseUnits,
        borrowedBaseUnits: "0",
        supplyApyBps: d.supplyApyBps,
        borrowApyBps: 0,
      };
    });
  }

  /** Live reserve snapshot for the UI: APY, pool TVL, our supplied position. */
  async getVaultData(): Promise<Result<BlendVaultData>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(async () => {
        const p = await mock.getPosition(this.poolId, "USDC");
        return {
          poolId: this.poolId,
          asset: "USDC",
          supplyApyBps: p.supplyApyBps,
          tvlBaseUnits: p.suppliedBaseUnits,
          positionBaseUnits: p.suppliedBaseUnits,
          network: "mock",
        };
      });
    }
    return tryAsync(() => this.loadVault(this.assetId));
  }

  async supply(asset: string, amountBaseUnits: string): Promise<Result<BlendPosition & { txHash?: string }>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.supply(this.poolId, asset, amountBaseUnits));
    }
    const resolvedAsset = this.resolveAssetAddress(asset);
    const res = await tryAsync(() => this.submitRequest(RequestType.Supply, resolvedAsset, amountBaseUnits));
    if (!res.ok && /MissingValue|TTL|trustline|balance/i.test(res.error.message)) {
      this.logger.warn({ pool: this.poolId, error: res.error.message }, "Blend supply recoverable error");
      return err(new Error(`Blend supply deferred: ${res.error.message}`));
    }
    return res;
  }

  async withdraw(asset: string, amountBaseUnits: string): Promise<Result<BlendPosition & { txHash?: string }>> {
    if (this.mock) {
      const mock = this.mock;
      return tryAsync(() => mock.withdraw(this.poolId, asset, amountBaseUnits));
    }
    const resolvedAsset = this.resolveAssetAddress(asset);
    return tryAsync(() => this.submitRequest(RequestType.Withdraw, resolvedAsset, amountBaseUnits));
  }

  // ── live helpers ──────────────────────────────────────────────────────────

  private async loadVault(asset: string): Promise<BlendVaultData> {
    const poolId = this.config.poolId as string;
    const pool = await PoolV2.load(this.net, poolId);
    const reserve = pool.reserves.get(asset);
    if (!reserve) throw new Error(`Blend pool ${poolId} has no reserve for ${asset}`);

    let positionBaseUnits = "0";
    if (this.positionHolderAddress) {
      try {
        const user = await pool.loadUser(this.positionHolderAddress);
        positionBaseUnits = user.getSupply(reserve).toString();
      } catch {
        /* user may have no position yet */
      }
    }
    const tvlBaseUnits = BigInt(Math.round(reserve.totalSupplyFloat() * 1e7)).toString();
    return {
      poolId,
      asset: asset === XLM_SAC ? "XLM" : (asset === "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU" ? "USDC" : asset),
      supplyApyBps: Math.round(reserve.estSupplyApy * 100),
      tvlBaseUnits,
      positionBaseUnits,
      network: this.net.passphrase.includes("Public") ? "mainnet" : "testnet",
    };
  }

  /**
   * Build the Blend pool `submit` op (SDK), sign it, and submit via Soroban
   * RPC — either directly with the platform key, or, when Milestone 1's
   * smart account is configured, through it instead (see
   * `smartAccountId`/`submitRequestViaSmartAccount`).
   */
  private async submitRequest(
    requestType: RequestType,
    asset: string,
    amountBaseUnits: string,
  ): Promise<BlendPosition & { txHash?: string }> {
    if (!this.canWrite) throw new Error("Blend writes disabled (missing pool/signer)");
    const txHash = this.config.smartAccountId
      ? await this.submitRequestViaSmartAccount(requestType, asset, amountBaseUnits, this.config.smartAccountId)
      : await this.submitRequestDirect(requestType, asset, amountBaseUnits);

    const pos = await this.getPosition(asset);
    const base: BlendPosition = pos.ok
      ? pos.value
      : { poolId: this.poolId, asset, suppliedBaseUnits: "0", borrowedBaseUnits: "0", supplyApyBps: 0, borrowApyBps: 0 };
    return { ...base, txHash };
  }

  private async submitRequestDirect(
    requestType: RequestType,
    asset: string,
    amountBaseUnits: string,
  ): Promise<string | undefined> {
    const addr = this.signerAddress as string;
    const opXdr = new PoolContractV2(this.config.poolId as string).submit({
      from: addr,
      spender: addr,
      to: addr,
      requests: [{ amount: BigInt(amountBaseUnits), request_type: requestType, address: asset }],
    });
    const res = await this.stellarClient.submitOperationXdr(opXdr, this.config.signerSecret as string);
    return res.txHash;
  }

  /**
   * Same `submit()` call, but addressed to the smart account (`from`/
   * `spender`/`to` are all the smart account's own address, since it — not
   * the agent's classic key — is what holds and controls the position) and
   * authorized via `invokeViaSmartAccount` instead of a direct signature.
   * Reuses the Blend SDK's own operation-building (`PoolContractV2.submit`)
   * for the `Request` encoding — just extracts its args rather than
   * hand-building the struct — so the on-the-wire shape is exactly what
   * Blend's SDK already knows is correct, not a hand-rolled duplicate.
   *
   * Requires two context rules on the smart account (verified end-to-end
   * with real testnet transactions, 2026-08-04 — see TECHNICAL.md §6): one
   * scoped to `asset` carrying the real spending cap (Blend's own internal
   * transfer of the underlying reserve token surfaces as its own auth
   * context), one scoped to `poolId` as a signer-only gateway (no cap there
   * — attaching one too would double-count the same spend).
   */
  private async submitRequestViaSmartAccount(
    requestType: RequestType,
    asset: string,
    amountBaseUnits: string,
    smartAccountId: string,
  ): Promise<string | undefined> {
    const poolId = this.config.poolId as string;
    const opXdr = new PoolContractV2(poolId).submit({
      from: smartAccountId,
      spender: smartAccountId,
      to: smartAccountId,
      requests: [{ amount: BigInt(amountBaseUnits), request_type: requestType, address: asset }],
    });
    const op = stellar.xdr.Operation.fromXDR(opXdr, "base64");
    const args = op.body().invokeHostFunctionOp().hostFunction().invokeContract().args();

    const res = await this.stellarClient.invokeViaSmartAccount({
      smartAccountId,
      targetContractId: poolId,
      method: "submit",
      args,
      contextRuleIdByTarget: {
        [asset]: this.config.smartAccountAssetRuleId ?? 1,
        [poolId]: this.config.smartAccountPoolRuleId ?? 2,
      },
      delegatedSignerSecret: this.config.signerSecret as string,
      feeSourceSecret: this.config.signerSecret as string,
    });
    return res.txHash;
  }

  /**
   * Build an UNSIGNED Blend `submit` transaction whose source + supplier is the
   * user's own wallet — the self-custody path. The frontend signs it with the
   * user's wallet (Freighter); we never touch their key. With the user as the
   * source account, their envelope signature satisfies the pool's `require_auth`.
   */
  async buildRequestXdr(
    userAddress: string,
    direction: "supply" | "withdraw",
    asset: string,
    amountBaseUnits: string,
  ): Promise<string> {
    if (!this.config.poolId) throw new Error("Blend pool not configured");
    const resolved = this.resolveAssetAddress(asset);
    const requestType = direction === "supply" ? RequestType.Supply : RequestType.Withdraw;
    const opXdr = new PoolContractV2(this.config.poolId).submit({
      from: userAddress,
      spender: userAddress,
      to: userAddress,
      requests: [{ amount: BigInt(amountBaseUnits), request_type: requestType, address: resolved }],
    });
    return this.stellarClient.buildOperationXdr(opXdr, userAddress);
  }

  /** Submit a user-signed Soroban transaction envelope and confirm (60s window).
   *  `returnValue` carries the contract's native return — e.g. the new vault
   *  address for a factory create-vault. */
  async submitSignedXdr(signedXdr: string): Promise<{ txHash: string; returnValue: unknown }> {
    const r = await this.stellarClient.submitSignedXdr(signedXdr, 60_000);
    return { txHash: r.txHash, returnValue: r.returnValue };
  }
}

export type { BlendPosition };
