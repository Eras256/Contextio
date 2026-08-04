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
    /// * `agent_signer` — the delegated signer (the agent's own Ed25519
    ///   address); it still signs with its own key, but everything it
    ///   authorizes through this contract is now bounded by the policy below.
    /// * `target_token` — the token this rule's spending limit applies to;
    ///   `CallContract` scoping is required by the spending-limit policy so
    ///   every tracked transfer is denominated in one asset.
    /// * `policy_contract` — the deployed `contexta-spending-limit-policy` address.
    /// * `spending_limit` / `period_ledgers` — the cap (stroops) and rolling
    ///   window (ledgers, ~5s each) it applies over.
    pub fn __constructor(
        e: &Env,
        agent_signer: Address,
        target_token: Address,
        policy_contract: Address,
        spending_limit: i128,
        period_ledgers: u32,
    ) {
        let signers: Vec<Signer> = Vec::from_array(e, [Signer::Delegated(agent_signer)]);
        let params = SpendingLimitAccountParams { spending_limit, period_ledgers };
        let mut policies: Map<Address, Val> = Map::new(e);
        policies.set(policy_contract, params.into_val(e));

        smart_account::add_context_rule(
            e,
            &ContextRuleType::CallContract(target_token),
            &String::from_str(e, "agent-spending-limit"),
            None,
            &signers,
            &policies,
        );
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
