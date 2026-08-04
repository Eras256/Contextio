extern crate std;

use soroban_sdk::{testutils::Address as _, vec, Address, Env, IntoVal, Symbol};
use stellar_accounts::smart_account::{ContextRuleType, Signer};

use crate::SmartTreasuryContract;
use contexta_spending_limit_policy::SpendingLimitPolicyContract;

/// Deploys the real policy contract + the real smart-treasury contract (not
/// mocks) with one delegated signer (standing in for the agent's Ed25519
/// address) bounded by a real spending-limit policy scoped to `token` — same
/// all-primitive constructor a real `stellar contract deploy` call uses.
fn deploy(e: &Env, agent: &Address, token: &Address, limit: i128, period_ledgers: u32) -> (Address, Address, u32) {
    let policy_contract = e.register(SpendingLimitPolicyContract, ());
    let account = e.register(
        SmartTreasuryContract,
        (agent.clone(), token.clone(), policy_contract.clone(), limit, period_ledgers),
    );
    (account, policy_contract, 0)
}

#[test]
fn constructor_wires_one_signer_and_the_spending_limit_policy() {
    let e = Env::default();
    e.mock_all_auths();

    let agent = Address::generate(&e);
    let token = Address::generate(&e);
    let (account, policy_contract, rule_id) = deploy(&e, &agent, &token, 100_0000000, 17_280);

    let client = crate::SmartTreasuryContractClient::new(&e, &account);
    let rule = client.get_context_rule(&rule_id);

    assert_eq!(rule.signers.len(), 1);
    assert!(rule.signers.contains(&Signer::Delegated(agent)));
    assert_eq!(rule.policies.len(), 1);
    assert_eq!(rule.policies.get(0).unwrap(), policy_contract);
    assert_eq!(rule.context_type, ContextRuleType::CallContract(token));
}

#[test]
fn spending_limit_policy_allows_a_transfer_within_the_cap() {
    let e = Env::default();
    e.mock_all_auths();

    let agent = Address::generate(&e);
    let token = Address::generate(&e);
    // 100 USDC/day cap (7-decimal stroops), well above the 40 spent below.
    let (account, policy_contract, rule_id) = deploy(&e, &agent, &token, 100_0000000, 17_280);

    let account_client = crate::SmartTreasuryContractClient::new(&e, &account);
    let rule = account_client.get_context_rule(&rule_id);

    let policy_client =
        contexta_spending_limit_policy::SpendingLimitPolicyContractClient::new(&e, &policy_contract);

    let from = Address::generate(&e);
    let to = Address::generate(&e);
    let context = soroban_sdk::auth::Context::Contract(soroban_sdk::auth::ContractContext {
        contract: token,
        fn_name: Symbol::new(&e, "transfer"),
        args: vec![&e, from.into_val(&e), to.into_val(&e), 40_0000000i128.into_val(&e)],
    });

    // Should not panic: 40 USDC is within the 100 USDC/day cap.
    policy_client.enforce(&context, &vec![&e, Signer::Delegated(agent)], &rule, &account);

    let data = policy_client.get_spending_limit_data(&rule_id, &account);
    assert_eq!(data.cached_total_spent, 40_0000000);
}

#[test]
#[should_panic(expected = "Error(Contract, #3221)")]
fn spending_limit_policy_blocks_a_transfer_over_the_cap() {
    let e = Env::default();
    e.mock_all_auths();

    let agent = Address::generate(&e);
    let token = Address::generate(&e);
    // 100 USDC/day cap — this is the guardrail that replaces an unbounded hot key.
    let (account, policy_contract, rule_id) = deploy(&e, &agent, &token, 100_0000000, 17_280);

    let account_client = crate::SmartTreasuryContractClient::new(&e, &account);
    let rule = account_client.get_context_rule(&rule_id);

    let policy_client =
        contexta_spending_limit_policy::SpendingLimitPolicyContractClient::new(&e, &policy_contract);

    let from = Address::generate(&e);
    let to = Address::generate(&e);
    // 150 USDC in one shot — over the 100 USDC/day cap, must be rejected.
    let context = soroban_sdk::auth::Context::Contract(soroban_sdk::auth::ContractContext {
        contract: token,
        fn_name: Symbol::new(&e, "transfer"),
        args: vec![&e, from.into_val(&e), to.into_val(&e), 150_0000000i128.into_val(&e)],
    });

    policy_client.enforce(&context, &vec![&e, Signer::Delegated(agent)], &rule, &account);
}
