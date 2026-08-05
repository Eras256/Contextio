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
        (
            agent.clone(),
            vec![e, token.clone()],           // capped_targets
            soroban_sdk::Vec::<Address>::new(e), // gateway_targets
            policy_contract.clone(),
            limit,
            period_ledgers,
        ),
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
fn constructor_wires_capped_targets_before_gateway_targets() {
    let e = Env::default();
    e.mock_all_auths();

    let agent = Address::generate(&e);
    let usdc = Address::generate(&e);
    let blend_asset = Address::generate(&e);
    let blend_pool = Address::generate(&e);
    let policy_contract = e.register(SpendingLimitPolicyContract, ());
    let account = e.register(
        SmartTreasuryContract,
        (
            agent.clone(),
            vec![&e, usdc.clone(), blend_asset.clone()], // capped_targets: rules 0, 1
            vec![&e, blend_pool.clone()],                // gateway_targets: rule 2
            policy_contract.clone(),
            100_0000000i128,
            17_280u32,
        ),
    );

    let client = crate::SmartTreasuryContractClient::new(&e, &account);
    assert_eq!(client.get_context_rules_count(), 3);

    let rule0 = client.get_context_rule(&0);
    assert_eq!(rule0.context_type, ContextRuleType::CallContract(usdc));
    assert_eq!(rule0.policies.len(), 1);
    assert!(rule0.signers.contains(&Signer::Delegated(agent.clone())));

    let rule1 = client.get_context_rule(&1);
    assert_eq!(rule1.context_type, ContextRuleType::CallContract(blend_asset));
    assert_eq!(rule1.policies.len(), 1);

    // Gateway rule: signer-gated only, deliberately NO policy attached — the
    // cap lives on the nested asset-level rule (rule 1), not here, or the
    // same real spend gets double-recorded (found and fixed 2026-08-04).
    let rule2 = client.get_context_rule(&2);
    assert_eq!(rule2.context_type, ContextRuleType::CallContract(blend_pool));
    assert_eq!(rule2.policies.len(), 0);
    assert!(rule2.signers.contains(&Signer::Delegated(agent.clone())));

    // Independent spending buckets: rule 0 and rule 1 must not share state.
    let policy_client =
        contexta_spending_limit_policy::SpendingLimitPolicyContractClient::new(&e, &policy_contract);
    let data0 = policy_client.get_spending_limit_data(&0, &account);
    let data1 = policy_client.get_spending_limit_data(&1, &account);
    assert_eq!(data0.cached_total_spent, 0);
    assert_eq!(data1.cached_total_spent, 0);
}

#[test]
fn gateway_rule_with_no_policy_only_requires_the_signer() {
    let e = Env::default();
    e.mock_all_auths();

    let agent = Address::generate(&e);
    let blend_pool = Address::generate(&e);
    let policy_contract = e.register(SpendingLimitPolicyContract, ());
    let account = e.register(
        SmartTreasuryContract,
        (
            agent.clone(),
            soroban_sdk::Vec::<Address>::new(&e), // capped_targets: none
            vec![&e, blend_pool.clone()],         // gateway_targets: rule 0
            policy_contract,
            100_0000000i128,
            17_280u32,
        ),
    );

    let client = crate::SmartTreasuryContractClient::new(&e, &account);
    let rule = client.get_context_rule(&0);
    assert_eq!(rule.policies.len(), 0);
    assert_eq!(rule.signers.len(), 1);
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
