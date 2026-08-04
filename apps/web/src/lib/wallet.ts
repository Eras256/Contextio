"use client";

import { getClientNetwork } from "./network";

/**
 * Stellar Wallets Kit (v2.x) integration. Dynamically imported so the wallet
 * SDKs never load during SSR. Supports Freighter, xBull, Albedo, Lobstr, Hana,
 * Rabet, Ledger, WalletConnect, etc. via a single connect modal.
 *
 * The kit is a module-level singleton initialized once with a fixed network
 * passphrase — reads the current network at first use (not at module load),
 * so switching networks (which reloads the page, see lib/network.ts) always
 * starts a fresh kit against the right one.
 */
type Kit = (typeof import("@creit.tech/stellar-wallets-kit"))["StellarWalletsKit"];

let kit: Kit | null = null;

async function getKit(): Promise<Kit> {
  if (!kit) {
    const [{ StellarWalletsKit, Networks }, { defaultModules }] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit"),
      import("@creit.tech/stellar-wallets-kit/modules/utils"),
    ]);
    StellarWalletsKit.init({
      network: getClientNetwork() === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
      modules: defaultModules(),
    });
    kit = StellarWalletsKit;
  }
  return kit;
}

/** Open the wallet picker modal and return the selected account's address. */
export async function connectWallet(): Promise<string> {
  const k = await getKit();
  const { address } = await k.authModal();
  return address;
}

/** Sign a SEP-53 message with the connected wallet; returns base64 signature. */
export async function signWalletMessage(message: string, address: string): Promise<string> {
  const k = await getKit();
  const { signedMessage } = await k.signMessage(message, { address });
  return signedMessage;
}

/** Sign a Stellar transaction envelope (base64 XDR) with the connected wallet. */
export async function signWalletTransaction(xdr: string, address: string): Promise<string> {
  const k = await getKit();
  const { signedTxXdr } = await k.signTransaction(xdr, { address });
  return signedTxXdr;
}

export async function disconnectWallet(): Promise<void> {
  try {
    const k = await getKit();
    await k.disconnect();
  } catch {
    /* ignore */
  }
}
