/**
 * Canonical, agent-fetchable Terms of Service — the actual document referenced
 * by `terms` (and hashed into `atrHash`) in the LCP discovery document.
 *
 * The Legal Context Protocol standard requires the terms document to be "a
 * standalone, downloadable file... not a webpage section or dynamically
 * rendered content" (legalcontextprotocol.org/standard) — a rendered React
 * page (like `/legal/terms`, which exists for humans in EN/ES/PT) does not
 * qualify. This plain-markdown constant is the single source of truth for
 * both: (1) what gets served as the raw fetchable file agents hash, and (2)
 * what `legalContextService.publish()` hashes into `atrHash` — so a verifier
 * fetching the served file and hashing it independently gets the exact value
 * declared in the discovery document. English is the canonical/hashed
 * version; the EN/ES/PT page at `/legal/terms` remains the human-facing
 * translation of record but is not itself the hashed artifact.
 */
export const CANONICAL_TERMS_MARKDOWN = `# Contextio — Terms of Service

_Last updated: 2026-06-30_

## 1. Scope of Services & Technology Provider Status

Contextio is a non-custodial technology platform (and not a financial services provider, fintech, bank, credit institution, or custodian) operating on the Stellar network. We provide purely technical software tools allowing businesses to configure automated treasury allocations (e.g., through Blend and DeFindex protocols) and execute localized payroll flows in Latin America (including Brazil, Argentina, and Colombia). The platform acts as an agentic assistant that proposes moves based on tenant-configured parameters; however, the ultimate execution and cryptographic authorization always remain with the tenant's operator keys.

## 2. Self-Custody and Security

You retain sole ownership and control of your private cryptographic keys and credentials (such as Freighter or other Stellar-compatible wallets). Contextio does not store, hold, or have access to your private keys. All blockchain-state modifications, including DeFi deposits, yields, and transfers, must be explicitly signed by you. You are entirely responsible for safeguarding your credentials and verifying all transaction parameters before signing.

## 3. Legal Context Protocol (LCP)

Contextio implements the Legal Context Protocol (LCP). Every state-changing transaction executed through the platform embeds a cryptographic binding (SHA-256 hash) linking directly to this Terms of Service document. By initiating and signing any agentic or manual transaction on-chain, you cryptographically bind your business to the terms, consent requirements, and dispute resolutions set forth herein at the time of execution.

## 4. Risk Disclosure

Blockchain transactions are public, irreversible, and inherit smart-contract risks. Interacting with third-party decentralized applications like Blend (lending pools) and DeFindex (index vaults) involves risks of protocol exploits, smart contract vulnerabilities, stablecoin peg failures, and extreme market volatility. Contextio is a technology provider, not a financial advisor or a custodian. All assets deployed on-chain are at your own risk.

## 5. Governing Law and Dispute Resolution

These Terms shall be governed by and construed in accordance with the laws of Brazil, Argentina, and Colombia depending on the jurisdiction of your tenant's registration. Any conflict, claim, or dispute arising out of these terms or our services shall be submitted to the default arbitration channel defined in the LCP manifest published at \`/.well-known/contextio-legal-context.json\` for your tenant, governed by the laws and languages specified therein.
`;
