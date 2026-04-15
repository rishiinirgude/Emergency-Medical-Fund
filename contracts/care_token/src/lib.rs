#![no_std]

//! CareToken — SEP-41 compatible fungible token.
//! Minted by the MedicalFund contract as a donor reward.
//! Rate: 1000 CARE per 1 XLM donated (scaled by STROOP: 1 XLM = 10_000_000 stroops).

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String, Symbol,
};

// ── Constants ─────────────────────────────────────────────────────────────────

/// 1000 CARE per 1 XLM. XLM uses 7 decimal places (stroops).
/// CARE uses 7 decimal places to match Stellar convention.
/// tokens = (stroops_donated * 1000) / 10_000_000
pub const TOKENS_PER_XLM: i128 = 1_000;
pub const STROOP: i128 = 10_000_000;

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    Minter,
    Balance(Address),
    TotalSupply,
}

const MINTER_UPDATED: Symbol = symbol_short!("CT_MINT");

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CareToken;

#[contractimpl]
impl CareToken {
    /// Initialize token with admin.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("CT: already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalSupply, &0_i128);
    }

    /// Set the minter address (should be MedicalFund). Admin only.
    pub fn set_minter(env: Env, new_minter: Address) {
        Self::require_admin(&env);
        let old_minter: Option<Address> = env.storage().instance().get(&DataKey::Minter);
        env.storage().instance().set(&DataKey::Minter, &new_minter);
        env.events()
            .publish((MINTER_UPDATED,), (old_minter, new_minter));
    }

    /// Mint reward tokens proportional to XLM donated (in stroops).
    /// Called by MedicalFund on each donation.
    pub fn mint_reward(env: Env, to: Address, stroop_amount: i128) {
        Self::require_minter(&env);
        let tokens = (stroop_amount * TOKENS_PER_XLM) / STROOP;
        if tokens <= 0 {
            return;
        }
        let balance = Self::balance_of(&env, &to);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to), &(balance + tokens));
        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + tokens));
    }

    // ── SEP-41 view functions ─────────────────────────────────────────────────

    pub fn name(_env: Env) -> String {
        String::from_str(&_env, "CareToken")
    }

    pub fn symbol(_env: Env) -> String {
        String::from_str(&_env, "CARE")
    }

    pub fn decimals(_env: Env) -> u32 {
        7
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        Self::balance_of(&env, &account)
    }

    pub fn minter(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Minter)
    }

    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("CT: not initialized")
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("CT: not initialized");
        admin.require_auth();
    }

    fn require_minter(env: &Env) {
        let minter: Address = env
            .storage()
            .instance()
            .get(&DataKey::Minter)
            .expect("CT: minter not set");
        minter.require_auth();
    }

    fn balance_of(env: &Env, account: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account.clone()))
            .unwrap_or(0)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn setup() -> (Env, CareTokenClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, CareToken);
        let client = CareTokenClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let minter = Address::generate(&env);
        client.initialize(&admin);
        client.set_minter(&minter);
        (env, client, admin, minter)
    }

    #[test]
    fn test_metadata() {
        let (env, client, _, _) = setup();
        assert_eq!(client.name(), String::from_str(&env, "CareToken"));
        assert_eq!(client.symbol(), String::from_str(&env, "CARE"));
        assert_eq!(client.decimals(), 7);
    }

    #[test]
    fn test_mint_reward() {
        let (_env, client, _admin, minter) = setup();
        let recipient = Address::generate(&_env);
        // Donate 1 XLM = 10_000_000 stroops → expect 1000 CARE
        client.mint_reward(&recipient, &10_000_000_i128);
        assert_eq!(client.balance(&recipient), 1_000_i128);
        assert_eq!(client.total_supply(), 1_000_i128);
    }

    #[test]
    fn test_mint_zero_does_nothing() {
        let (_env, client, _admin, _minter) = setup();
        let recipient = Address::generate(&_env);
        client.mint_reward(&recipient, &0_i128);
        assert_eq!(client.balance(&recipient), 0);
    }

    #[test]
    #[should_panic(expected = "CT: minter not set")]
    fn test_non_minter_cannot_mint() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, CareToken);
        let client = CareTokenClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        // No minter set — should panic
        let recipient = Address::generate(&env);
        client.mint_reward(&recipient, &10_000_000_i128);
    }
}
