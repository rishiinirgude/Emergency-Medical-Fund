#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, Vec, Symbol,
};

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    Verified(Address),
    HospitalList,
}

// ── Events ────────────────────────────────────────────────────────────────────

const HOSPITAL_ADDED: Symbol = symbol_short!("HV_ADD");
const HOSPITAL_REMOVED: Symbol = symbol_short!("HV_REM");

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct HospitalVerification;

#[contractimpl]
impl HospitalVerification {
    /// Initialize the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("HV: already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::HospitalList, &Vec::<Address>::new(&env));
    }

    /// Add a hospital to the verified whitelist. Admin only.
    pub fn add_hospital(env: Env, hospital: Address) {
        Self::require_admin(&env);

        let key = DataKey::Verified(hospital.clone());
        if env.storage().persistent().get::<_, bool>(&key).unwrap_or(false) {
            panic!("HV: already verified");
        }

        env.storage().persistent().set(&key, &true);

        let mut list = Self::get_hospital_list(&env);
        list.push_back(hospital.clone());
        env.storage()
            .instance()
            .set(&DataKey::HospitalList, &list);

        env.events()
            .publish((HOSPITAL_ADDED,), (hospital, env.ledger().timestamp()));
    }

    /// Remove a hospital from the whitelist. Admin only.
    pub fn remove_hospital(env: Env, hospital: Address) {
        Self::require_admin(&env);

        let key = DataKey::Verified(hospital.clone());
        if !env.storage().persistent().get::<_, bool>(&key).unwrap_or(false) {
            panic!("HV: not verified");
        }

        env.storage().persistent().set(&key, &false);

        let list = Self::get_hospital_list(&env);
        let mut new_list = Vec::new(&env);
        for h in list.iter() {
            if h != hospital {
                new_list.push_back(h);
            }
        }
        env.storage()
            .instance()
            .set(&DataKey::HospitalList, &new_list);

        env.events()
            .publish((HOSPITAL_REMOVED,), (hospital, env.ledger().timestamp()));
    }

    /// Check whether a hospital address is verified.
    pub fn is_verified(env: Env, hospital: Address) -> bool {
        let key = DataKey::Verified(hospital);
        env.storage().persistent().get::<_, bool>(&key).unwrap_or(false)
    }

    /// Return the full list of verified hospitals.
    pub fn get_hospitals(env: Env) -> Vec<Address> {
        Self::get_hospital_list(&env)
    }

    /// Total number of verified hospitals.
    pub fn hospital_count(env: Env) -> u32 {
        Self::get_hospital_list(&env).len()
    }

    /// Return the admin address.
    pub fn admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("HV: not initialized")
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("HV: not initialized");
        admin.require_auth();
    }

    fn get_hospital_list(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::HospitalList)
            .unwrap_or_else(|| Vec::new(env))
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn setup() -> (Env, HospitalVerificationClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, HospitalVerification);
        let client = HospitalVerificationClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let hospital = Address::generate(&env);
        client.initialize(&admin);
        (env, client, admin, hospital)
    }

    #[test]
    fn test_initialize() {
        let (_env, client, admin, _hospital) = setup();
        assert_eq!(client.admin(), admin);
        assert_eq!(client.hospital_count(), 0);
    }

    #[test]
    fn test_add_and_verify_hospital() {
        let (_env, client, _admin, hospital) = setup();
        assert!(!client.is_verified(&hospital));
        client.add_hospital(&hospital);
        assert!(client.is_verified(&hospital));
        assert_eq!(client.hospital_count(), 1);
    }

    #[test]
    fn test_remove_hospital() {
        let (_env, client, _admin, hospital) = setup();
        client.add_hospital(&hospital);
        client.remove_hospital(&hospital);
        assert!(!client.is_verified(&hospital));
        assert_eq!(client.hospital_count(), 0);
    }

    #[test]
    #[should_panic(expected = "HV: already verified")]
    fn test_add_duplicate_panics() {
        let (_env, client, _admin, hospital) = setup();
        client.add_hospital(&hospital);
        client.add_hospital(&hospital);
    }

    #[test]
    #[should_panic(expected = "HV: not verified")]
    fn test_remove_unverified_panics() {
        let (_env, client, _admin, hospital) = setup();
        client.remove_hospital(&hospital);
    }

    #[test]
    fn test_get_hospitals_list() {
        let (env, client, _admin, hospital) = setup();
        let hospital2 = Address::generate(&env);
        client.add_hospital(&hospital);
        client.add_hospital(&hospital2);
        let list = client.get_hospitals();
        assert_eq!(list.len(), 2);
    }
}
