#![no_std]
//! Contextio spending-limit policy contract.
//!
//! Thin wrapper around OpenZeppelin's `stellar_accounts::policies::spending_limit`
//! module (audited upstream, not our logic) — deploy once, any number of smart
//! accounts can reference this contract's address in their context rules.
//! This is the piece that bounds `contexta-smart-treasury`'s agent signer to a
//! rolling-window spending cap instead of unlimited authority.
//!
//! No custom translation logic here on purpose — see `contracts/smart-
//! treasury`'s constructor doc comment for why. In short: a real Blend
//! `submit()` Supply call, invoked directly (not wrapped in `execute()`),
//! generates its OWN nested `transfer`-shaped auth context for the
//! underlying reserve token — verified against the real deployed contract
//! on testnet (2026-08-04) — so `spending_limit::enforce`'s stock
//! `fn_name == "transfer"` check already matches it natively, as long as a
//! context rule is scoped to that reserve token contract. An earlier version
//! of this contract added a `translate_blend_submit` helper to re-express
//! `submit()` itself as a synthetic transfer; removed after finding it
//! double-recorded the same spend against two independent rule buckets
//! (once via the translation, once via the real nested context) with no
//! corresponding safety benefit.

use soroban_sdk::{auth::Context, contract, contractimpl, Address, Env, Vec};
use stellar_accounts::{
    policies::{spending_limit, Policy},
    smart_account::{ContextRule, Signer},
};

#[contract]
pub struct SpendingLimitPolicyContract;

#[contractimpl]
impl Policy for SpendingLimitPolicyContract {
    type AccountParams = spending_limit::SpendingLimitAccountParams;

    fn enforce(
        e: &Env,
        context: Context,
        authenticated_signers: Vec<Signer>,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        spending_limit::enforce(e, &context, &authenticated_signers, &context_rule, &smart_account)
    }

    fn install(
        e: &Env,
        install_params: Self::AccountParams,
        context_rule: ContextRule,
        smart_account: Address,
    ) {
        spending_limit::install(e, &install_params, &context_rule, &smart_account)
    }

    fn uninstall(e: &Env, context_rule: ContextRule, smart_account: Address) {
        spending_limit::uninstall(e, &context_rule, &smart_account)
    }
}

#[contractimpl]
impl SpendingLimitPolicyContract {
    pub fn get_spending_limit_data(
        e: Env,
        context_rule_id: u32,
        smart_account: Address,
    ) -> spending_limit::SpendingLimitData {
        spending_limit::get_spending_limit_data(&e, context_rule_id, &smart_account)
    }

    pub fn set_spending_limit(e: Env, spending_limit_amount: i128, context_rule: ContextRule, smart_account: Address) {
        spending_limit::set_spending_limit(&e, spending_limit_amount, &context_rule, &smart_account)
    }
}
