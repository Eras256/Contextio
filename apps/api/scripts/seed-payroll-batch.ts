/**
 * Seeds N new testnet contractor wallets (friendbot-funded, USDC-trustlined),
 * adds them as payroll employees on the public demo tenant alongside the
 * existing employees, and executes a real one-off payroll run — producing a
 * single Horizon transaction with one payment operation per Stellar-wallet
 * recipient (see `SorobanGateway.executePayrollRun` / `StellarClient.sendPayments`).
 *
 * This is evidence-generation for a real multi-recipient batch settlement
 * (as opposed to the single-employee demo runs already in the run history),
 * scripted through the actual product pipeline (POST /payroll/employees →
 * /payroll/schedules → /payroll/runs) rather than a raw Horizon script, so
 * it exercises the same code path a real customer's payroll run would.
 *
 * Authenticates via the wallet sign-in demo bypass (`AUTH_DEMO_TENANT_ID`,
 * see apps/api/fly.toml) with a freshly generated throwaway keypair — this
 * is the exact same "connect any wallet, land in the public demo tenant"
 * behavior the live site already exposes, not a special-case credential.
 *
 * Usage:
 *   USDC_ISSUER=G... \
 *   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org \
 *   STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015" \
 *   API_BASE_URL=https://contextio-api.fly.dev/api/v1 \
 *   NEW_CONTRACTOR_COUNT=22 \
 *   tsx apps/api/scripts/seed-payroll-batch.ts
 */
import { createHash } from "node:crypto";
import { stellar } from "@contextio/shared";

const { Keypair, Horizon, Asset, Operation, TransactionBuilder, BASE_FEE } = stellar;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const USDC_ISSUER = requireEnv("USDC_ISSUER");
const HORIZON_URL = process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
const API_BASE = process.env.API_BASE_URL ?? "https://contextio-api.fly.dev/api/v1";
const NEW_COUNT = Number(process.env.NEW_CONTRACTOR_COUNT ?? "22");
const COUNTRIES = ["BR", "AR", "CO"] as const;

const horizon = new Horizon.Server(HORIZON_URL);

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function friendbotFund(pub: string): Promise<void> {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(pub)}`);
  if (!res.ok) throw new Error(`friendbot failed for ${pub}: ${res.status} ${await res.text()}`);
}

async function loadAccountWithRetry(pub: string, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await horizon.loadAccount(pub);
    } catch (e) {
      if (i === attempts - 1) throw e;
      await sleep(2000);
    }
  }
  throw new Error("unreachable");
}

async function establishUsdcTrustline(kp: InstanceType<typeof Keypair>): Promise<void> {
  const account = await loadAccountWithRetry(kp.publicKey());
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
}

async function signInAsDemoOwner(): Promise<{ token: string; tenantId: string; role: string; address: string }> {
  const authKp = Keypair.random();
  const chRes = await fetch(`${API_BASE}/auth/wallet/challenge`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: authKp.publicKey() }),
  });
  if (!chRes.ok) throw new Error(`challenge failed: ${chRes.status} ${await chRes.text()}`);
  const { message, hmac } = (await chRes.json()) as { message: string; hmac: string };

  const payload = Buffer.concat([Buffer.from("Stellar Signed Message:\n", "utf8"), Buffer.from(message, "utf8")]);
  const hash = createHash("sha256").update(payload).digest();
  const signedMessage = authKp.sign(hash).toString("base64");

  const vRes = await fetch(`${API_BASE}/auth/wallet/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: authKp.publicKey(), message, hmac, signedMessage }),
  });
  if (!vRes.ok) throw new Error(`verify failed: ${vRes.status} ${await vRes.text()}`);
  return (await vRes.json()) as { token: string; tenantId: string; role: string; address: string };
}

interface Employee {
  id: string;
  active: boolean;
  walletAddress: string | null;
}

async function main() {
  console.log(`Provisioning ${NEW_COUNT} new testnet contractor wallets...`);
  const wallets: { kp: InstanceType<typeof Keypair>; country: (typeof COUNTRIES)[number] }[] = [];
  for (let i = 0; i < NEW_COUNT; i++) {
    const kp = Keypair.random();
    await friendbotFund(kp.publicKey());
    await establishUsdcTrustline(kp);
    const country = COUNTRIES[i % COUNTRIES.length];
    wallets.push({ kp, country });
    console.log(`  [${i + 1}/${NEW_COUNT}] funded + USDC trustline: ${kp.publicKey()} (${country})`);
  }

  console.log("Signing in via wallet demo bypass to get an owner session on the public demo tenant...");
  const session = await signInAsDemoOwner();
  console.log(`  Authenticated as ${session.address}, tenant ${session.tenantId}, role ${session.role}`);
  const authHeaders = {
    "content-type": "application/json",
    authorization: `Bearer ${session.token}`,
    "x-tenant-id": session.tenantId,
  };

  const existingRes = await fetch(`${API_BASE}/payroll/employees`, { headers: authHeaders });
  if (!existingRes.ok) throw new Error(`list employees failed: ${existingRes.status} ${await existingRes.text()}`);
  const existing = (await existingRes.json()) as Employee[];
  const employeeIds = existing.filter((e) => e.active && e.walletAddress).map((e) => e.id);
  console.log(`Found ${employeeIds.length} existing active employee(s) with a Stellar wallet.`);

  console.log(`Creating ${wallets.length} new employee records...`);
  for (let i = 0; i < wallets.length; i++) {
    const w = wallets[i];
    const body = {
      fullName: `SCF Batch Contractor ${String(i + 1).padStart(2, "0")}`,
      email: null,
      country: w.country,
      walletAddress: w.kp.publicKey(),
      bankReference: null,
      payoutAsset: "USDC",
      preferredRail: "STELLAR",
      salaryAmount: "100.00",
      active: true,
    };
    const res = await fetch(`${API_BASE}/payroll/employees`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
    });
    const saved = await res.json();
    if (!res.ok) throw new Error(`employee create failed: ${JSON.stringify(saved)}`);
    employeeIds.push(saved.id);
  }
  console.log(`Total recipients for this run: ${employeeIds.length}`);

  const scheduleBody = {
    name: `SCF batch evidence run ${new Date().toISOString()}`,
    cadence: "one_off",
    nextRunAt: new Date(Date.now() + 60_000).toISOString(),
    asset: "USDC",
    rail: "STELLAR",
    employeeIds,
    active: true,
  };
  console.log("Creating one-off schedule...");
  const schedRes = await fetch(`${API_BASE}/payroll/schedules`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(scheduleBody),
  });
  const schedule = await schedRes.json();
  if (!schedRes.ok) throw new Error(`schedule create failed: ${JSON.stringify(schedule)}`);
  console.log(`  Schedule created: ${schedule.id}`);

  console.log("Executing the run for real (dryRun: false)...");
  const runRes = await fetch(`${API_BASE}/payroll/runs`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ scheduleId: schedule.id, dryRun: false }),
  });
  const run = await runRes.json();
  if (!runRes.ok) throw new Error(`run failed: ${JSON.stringify(run)}`);

  console.log("\n=== RUN RESULT ===");
  console.log(`runId:          ${run.id}`);
  console.log(`status:         ${run.status}`);
  console.log(`recipientCount: ${run.lines.length}`);
  console.log(`stellarTxHash:  ${run.stellarTxHash}`);
  console.log(`totalAmount:    ${run.totalAmount} ${run.asset} (nominal, 1:100 scaled on-chain)`);
  console.log(`legalContextId: ${run.legalContextId}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
