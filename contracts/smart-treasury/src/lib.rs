#![no_std]
//! Contextio smart-account treasury signer.
//!
//! Wraps the agent's own Ed25519 address as a `Signer::Delegated` inside an
//! OpenZeppelin Stellar smart account, bounded by a spending-limit policy
//! (`contexta-spending-limit-policy`) instead of holding unrestricted signing
//! power. This is Milestone 1 of the mainnet-launch plan: the real fix for
//! "the autonomous agent needs a hot key" — the agent still signs with its
//! own Ed25519 key, but that key can now only ever authorize what this
//! contract's context rule + policy allow, never more. It cannot itself move
//! funds outside the configured limit, no matter what the off-chain agent
//! process is told to do.
//!
//! Deliberately minimal for this first testnet deployment: one context rule,
//! one signer, one policy. No multisig, no upgradeability — those are real
//! next steps, not needed to prove the pattern end-to-end on-chain.

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contractimpl,
    crypto::Hash,
    Address, Env, IntoVal, Map, String, Symbol, Val, Vec,
};
use stellar_accounts::{
    policies::spending_limit::SpendingLimitAccountParams,
    smart_account::{
        self, AuthPayload, ContextRule, ContextRuleType, ExecutionEntryPoint, Signer, SmartAccount,
        SmartAccountError,
    },
};

#[contract]
pub struct SmartTreasuryContract;

#[contractimpl]
impl SmartTreasuryContract {
    /// All-primitive constructor (no `Map<Address, Val>` from the caller) so
    /// this is deployable with plain `stellar contract deploy -- --arg value`
    /// — the `Signer`/policy `Map` that OpenZeppelin's framework expects is
    /// built internally instead of pushed onto whoever runs the deploy.
    ///
    /// One context rule is created PER entry across `capped_targets` then
    /// `gateway_targets` (in that order — `capped_targets` get the lowest
    /// rule ids). `CallContract` scoping binds to the contract actually
    /// being invoked, not the asset moved — verified on-chain, 2026-08-04: a
    /// direct `pool.submit(...)` call's OWN auth context carries the Blend
    /// pool's address, and Blend's internal call to the underlying reserve
    /// token's `transfer()` (for a Supply) generates a SECOND, separate
    /// nested context carrying the token's address. Both need a matching
    /// rule for `__check_auth` to accept the call at all — but only ONE of
    /// them should carry the actual spending cap, or the same real spend
    /// gets recorded twice (found and removed 2026-08-04: an earlier version
    /// routed both through the policy and double-counted every Supply).
    ///
    /// * `capped_targets` — contracts where the auth context IS the real
    ///   asset movement (a token SAC's own `transfer`, or the underlying
    ///   reserve token a lending pool internally moves) — these get
    ///   `policy_contract` attached, so `spending_limit::enforce` actually
    ///   tracks and caps spend against them.
    /// * `gateway_targets` — contracts where the auth context is an outer,
    ///   non-asset-shaped call (e.g. Blend's `pool.submit(...)` itself) that
    ///   only needs "is this the right signer", not its own cap — the real
    ///   cap lives on the nested asset-level context instead. These rules
    ///   get NO policy (pure signer-gate); attaching the same policy here
    ///   too is exactly the double-counting bug described above.
    /// * `agent_signer` — the delegated signer (the agent's own Ed25519
    ///   address); it still signs with its own key, but everything it
    ///   authorizes through this contract is now bounded by the rules above.
    /// * `policy_contract` — the deployed `contexta-spending-limit-policy` address.
    /// * `spending_limit` / `period_ledgers` — the PER-`capped_targets`-RULE
    ///   cap (stroops) and rolling window (ledgers, ~5s each).
    ///
    /// Rules can only be added here, at construction — every `SmartAccount`
    /// admin function (`add_context_rule`/`add_policy`/...) is itself gated
    /// by `e.current_contract_address().require_auth()`, which after deploy
    /// has no matching rule to authorize against (no `Default`/self-
    /// `CallContract` rule exists) — so this list must be complete up front,
    /// redeploy to add a target later. Each capped rule gets its own
    /// independent spending-limit bucket (keyed by `(smart_account,
    /// context_rule_id)`) — the real worst-case daily ceiling is the SUM
    /// across `capped_targets`, not one shared pool.
    pub fn __constructor(
        e: &Env,
        agent_signer: Address,
        capped_targets: Vec<Address>,
        gateway_targets: Vec<Address>,
        policy_contract: Address,
        spending_limit: i128,
        period_ledgers: u32,
    ) {
        let params = SpendingLimitAccountParams { spending_limit, period_ledgers };
        let mut rule_index: u32 = 0;
        for target in capped_targets.iter() {
            let signers: Vec<Signer> = Vec::from_array(e, [Signer::Delegated(agent_signer.clone())]);
            let mut policies: Map<Address, Val> = Map::new(e);
            policies.set(policy_contract.clone(), params.into_val(e));
            smart_account::add_context_rule(
                e,
                &ContextRuleType::CallContract(target),
                &rule_name(e, rule_index),
                None,
                &signers,
                &policies,
            );
            rule_index += 1;
        }
        for target in gateway_targets.iter() {
            let signers: Vec<Signer> = Vec::from_array(e, [Signer::Delegated(agent_signer.clone())]);
            let policies: Map<Address, Val> = Map::new(e); // empty — signer-gate only, no cap here.
            smart_account::add_context_rule(
                e,
                &ContextRuleType::CallContract(target),
                &rule_name(e, rule_index),
                None,
                &signers,
                &policies,
            );
            rule_index += 1;
        }
    }
}

/// MAX_NAME_SIZE is 20 bytes and `no_std` has no cheap int-to-string
/// formatting, so this handful of fixed names covers the small, known set
/// of targets this account is ever deployed with.
fn rule_name(e: &Env, index: u32) -> String {
    match index {
        0 => String::from_str(e, "agent-limit-0"),
        1 => String::from_str(e, "agent-limit-1"),
        2 => String::from_str(e, "agent-limit-2"),
        3 => String::from_str(e, "agent-limit-3"),
        _ => String::from_str(e, "agent-limit-x"),
    }
}

#[contractimpl]
impl CustomAccountInterface for SmartTreasuryContract {
    type Error = SmartAccountError;
    type Signature = AuthPayload;

    fn __check_auth(
        e: Env,
        signature_payload: Hash<32>,
        signatures: AuthPayload,
        auth_contexts: Vec<Context>,
    ) -> Result<(), Self::Error> {
        smart_account::do_check_auth(&e, &signature_payload, &signatures, &auth_contexts)
    }
}

#[contractimpl(contracttrait)]
impl SmartAccount for SmartTreasuryContract {}

#[contractimpl(contracttrait)]
impl ExecutionEntryPoint for SmartTreasuryContract {}

#[cfg(test)]
mod test;
