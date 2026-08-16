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

_Last updated: 2026-08-16 (rev. 3)_

## 1. Scope of Services & Technology Provider Status

Contextio is a non-custodial technology platform (and not a financial services provider, fintech, bank, credit institution, or custodian) operating on the Stellar network. We provide purely technical software tools allowing businesses to configure automated treasury allocations (e.g., through Blend and DeFindex protocols) and execute localized payroll flows in Latin America (including Brazil, Argentina, and Colombia). The platform acts as an agentic assistant that proposes moves based on tenant-configured parameters; however, the ultimate execution and cryptographic authorization always remain with the tenant's operator keys.

## 2. Self-Custody and Security

You retain sole ownership and control of your private cryptographic keys and credentials (such as Freighter or other Stellar-compatible wallets). Contextio does not store, hold, or have access to your private keys. All blockchain-state modifications, including DeFi deposits, yields, and transfers, must be explicitly signed by you. You are entirely responsible for safeguarding your credentials and verifying all transaction parameters before signing.

## 3. Legal Context Protocol (LCP)

Contextio implements the Legal Context Protocol (LCP). Every state-changing transaction executed through the platform embeds a cryptographic binding (SHA-256 hash) linking directly to this Terms of Service document. By initiating and signing any agentic or manual transaction on-chain, you cryptographically bind your business to the terms, consent requirements, and dispute resolutions set forth herein at the time of execution.

## 4. Risk Disclosure

Blockchain transactions are public, irreversible, and inherit smart-contract risks. Interacting with third-party decentralized applications like Blend (lending pools) and DeFindex (index vaults) involves risks of protocol exploits, smart contract vulnerabilities, stablecoin peg failures, and extreme market volatility. Contextio is a technology provider, not a financial advisor or a custodian. All assets deployed on-chain are at your own risk.

## 5. Governing Law and Dispute Resolution

These Terms shall be governed by and construed in accordance with the laws of Brazil, Argentina, Colombia, or Switzerland, depending on the jurisdiction of your tenant's registration or the applicable dispute venue. Any conflict, claim, or dispute arising out of these terms or our services shall be submitted to the matching arbitration channel defined in the LCP manifest published at \`/.well-known/contextio-legal-context.json\` for your tenant, governed by the laws and languages specified therein. The current, authoritative list of jurisdictions and dispute channels is always the \`jurisdictions\` and \`disputeChannels\` fields of that manifest, human-readable at \`/legal-context\`.

## 6. Restricted Jurisdictions

Self-custody treasury and payout actions (the features that build a transaction for you to sign in your own wallet) are not offered to, and may not be used by, any person or entity located in, incorporated in, or a resident of: (a) any member state of the European Union or the European Economic Area, where Regulation (EU) 2023/1114 (MiCA) establishes a union-wide licensing regime for crypto-asset service providers; or (b) the United States, where money-transmission is regulated federally by FinCEN under the Bank Secrecy Act and separately by up to fifty individual state licensing regimes. These two reflect jurisdictions with a well-documented regime we have not yet had reviewed for this specific non-custodial pattern — it is not a claim that Contextio has been confirmed safe everywhere else, only that these two carry a specific, known, and material cost to get wrong.

Self-custody actions are separately unavailable to any person or entity located in, incorporated in, or a resident of the People's Republic of China (excluding the Hong Kong and Macao Special Administrative Regions and Taiwan). This is not a pending-review exclusion: the People's Bank of China's September 2021 notice ("Notice on Further Preventing and Disposing of the Risks of Speculation in Virtual Currency Trading", 关于进一步防范和处置虚拟货币交易炒作风险的通知) declares crypto-asset business activity illegal and expressly extends that prohibition to offshore platforms serving mainland Chinese residents over the internet — an already-effective restriction, not a regime awaiting review.

By checking the jurisdiction attestation box before a self-custody action, you confirm you are not located in, incorporated in, or a resident of any of the above.
`;
