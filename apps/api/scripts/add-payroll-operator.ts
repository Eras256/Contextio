/**
 * Manual, offline provisioning for self-custody payroll on mainnet.
 *
 * `PayrollService.prepareRun` calls `SorobanGateway.ensureOperator` on every
 * prepare, which auto-provisions on testnet (the admin secret is configured
 * there) but is deliberately a no-op on a mainnet deployment — per the
 * mainnet boot guard (`packages/config/src/env.ts`), a mainnet-scoped API
 * process may never hold `STELLAR_SERVICE_SECRET`. Allowlisting a company's
 * treasury wallet as a payroll `operator` on mainnet is therefore a human,
 * out-of-band action: run this script from a machine that holds the admin
 * key, once per tenant, before that tenant's first mainnet payout.
 *
 * Usage:
 *   STELLAR_NETWORK=mainnet \
 *   STELLAR_RPC_URL=https://<your-mainnet-rpc-provider> \
 *   STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015" \
 *   PAYROLL_CONTRACT_ID=C... \
 *   PAYROLL_ADMIN_SECRET=S... \
 *   OPERATOR_ADDRESS=G... \
 *   tsx apps/api/scripts/add-payroll-operator.ts
 *
 * This intentionally does NOT go through @contextio/config's loadServerEnv —
 * that loader refuses to boot on mainnet with any signer secret present. This
 * script is the one deliberate exception, and it never runs as part of the
 * live API/worker processes.
 */
import { stellar } from "@contextio/shared";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const network = process.env.STELLAR_NETWORK ?? "testnet";
  const rpcUrl = requireEnv("STELLAR_RPC_URL");
  const networkPassphrase = requireEnv("STELLAR_NETWORK_PASSPHRASE");
  const payrollContractId = requireEnv("PAYROLL_CONTRACT_ID");
  const adminSecret = requireEnv("PAYROLL_ADMIN_SECRET");
  const operatorAddress = requireEnv("OPERATOR_ADDRESS");

  if (!/^S[A-Z2-7]{55}$/.test(adminSecret)) throw new Error("PAYROLL_ADMIN_SECRET is not a valid Stellar secret seed");
  if (!/^G[A-Z2-7]{55}$/.test(operatorAddress)) throw new Error("OPERATOR_ADDRESS is not a valid Stellar public key");

  const client = new stellar.StellarClient({
    network: network as "testnet" | "mainnet" | "local",
    rpcUrl,
    horizonUrl: process.env.STELLAR_HORIZON_URL ?? "",
    networkPassphrase,
  });
  const { StellarClient } = stellar;

  const already = await client.simulate({
    contractId: payrollContractId,
    method: "is_operator",
    args: [StellarClient.toScVal(operatorAddress, { type: "address" })],
  });
  if (already === true) {
    console.log(`${operatorAddress} is already a payroll operator on ${payrollContractId}. Nothing to do.`);
    return;
  }

  console.log(`Adding ${operatorAddress} as a payroll operator on ${payrollContractId} (network: ${network})...`);
  const res = await client.invoke({
    contractId: payrollContractId,
    method: "add_operator",
    sourceSecret: adminSecret,
    args: [StellarClient.toScVal(operatorAddress, { type: "address" })],
  });
  console.log(`Done. tx: ${res.txHash}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
