#![no_std]

//! MedicalFund — Core crowdfunding contract on Stellar/Soroban.
//!
//! Inter-contract calls:
//!   • HospitalVerification.is_verified() — on create_campaign
//!   • CareToken.mint_reward()            — on donate

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    token, Address, Env, IntoVal, Symbol, Vec,
};

pub const APPROVAL_THRESHOLD: u32 = 2;

// ── Storage Keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    HvContract,
    CtContract,
    XlmToken,
    CampaignCount,
    Campaign(u32),
    MilestoneCount(u32),
    Milestone(u32, u32),
    Donation(u32, Address),
    Donors(u32),
    HasApproved(u32, u32, Address),
}

// ── Data Structures ───────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub struct Campaign {
    pub creator: Address,
    pub patient: Address,
    pub hospital: Address,
    pub target_amount: i128,
    pub total_raised: i128,
    pub total_released: i128,
    pub active: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    pub amount: i128,
    pub approved: bool,
    pub released: bool,
    pub approval_count: u32,
}

// ── Events ────────────────────────────────────────────────────────────────────

const EVT_CAMPAIGN_CREATED:   Symbol = symbol_short!("MF_CAMP");
const EVT_DONATION:           Symbol = symbol_short!("MF_DON");
const EVT_MILESTONE_ADDED:    Symbol = symbol_short!("MF_MADD");
const EVT_MILESTONE_APPROVED: Symbol = symbol_short!("MF_MAPV");
const EVT_MILESTONE_RELEASED: Symbol = symbol_short!("MF_MREL");
const EVT_CAMPAIGN_CLOSED:    Symbol = symbol_short!("MF_CLOS");

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct MedicalFund;

#[contractimpl]
impl MedicalFund {
    pub fn initialize(
        env: Env,
        admin: Address,
        hv_contract: Address,
        ct_contract: Address,
        xlm_token: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("MF: already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::HvContract, &hv_contract);
        env.storage().instance().set(&DataKey::CtContract, &ct_contract);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage().instance().set(&DataKey::CampaignCount, &0_u32);
    }

    // ── Campaign ──────────────────────────────────────────────────────────────

    pub fn create_campaign(
        env: Env,
        creator: Address,
        patient: Address,
        hospital: Address,
        target_amount: i128,
    ) -> u32 {
        creator.require_auth();
        if target_amount <= 0 {
            panic!("MF: target must be > 0");
        }

        // Inter-contract call: HospitalVerification.is_verified()
        let hv: Address = env.storage().instance().get(&DataKey::HvContract).unwrap();
        let is_verified: bool = env.invoke_contract(
            &hv,
            &Symbol::new(&env, "is_verified"),
            soroban_sdk::vec![&env, hospital.clone().into_val(&env)],
        );
        if !is_verified {
            panic!("MF: hospital not verified");
        }

        let campaign_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);

        let campaign = Campaign {
            creator: creator.clone(),
            patient,
            hospital: hospital.clone(),
            target_amount,
            total_raised: 0,
            total_released: 0,
            active: true,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.storage().persistent().set(&DataKey::MilestoneCount(campaign_id), &0_u32);
        env.storage().persistent().set(&DataKey::Donors(campaign_id), &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::CampaignCount, &(campaign_id + 1));

        env.events().publish(
            (EVT_CAMPAIGN_CREATED,),
            (campaign_id, creator, hospital, target_amount, env.ledger().timestamp()),
        );

        campaign_id
    }

    // ── Donation ──────────────────────────────────────────────────────────────

    pub fn donate(env: Env, donor: Address, campaign_id: u32, amount: i128) {
        donor.require_auth();
        if amount <= 0 {
            panic!("MF: donation must be > 0");
        }

        let mut campaign = Self::get_active_campaign(&env, campaign_id);

        // Transfer XLM from donor to this contract
        let xlm_token: Address = env.storage().instance().get(&DataKey::XlmToken).unwrap();
        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        // Track donor
        let donation_key = DataKey::Donation(campaign_id, donor.clone());
        let prev: i128 = env.storage().persistent().get(&donation_key).unwrap_or(0);
        if prev == 0 {
            let mut donors: Vec<Address> = env
                .storage()
                .persistent()
                .get(&DataKey::Donors(campaign_id))
                .unwrap_or_else(|| Vec::new(&env));
            donors.push_back(donor.clone());
            env.storage().persistent().set(&DataKey::Donors(campaign_id), &donors);
        }
        env.storage().persistent().set(&donation_key, &(prev + amount));
        campaign.total_raised += amount;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        // Inter-contract call: CareToken.mint_reward()
        let ct: Address = env.storage().instance().get(&DataKey::CtContract).unwrap();
        let _: () = env.invoke_contract(
            &ct,
            &Symbol::new(&env, "mint_reward"),
            soroban_sdk::vec![
                &env,
                donor.clone().into_val(&env),
                amount.into_val(&env)
            ],
        );

        let care_minted = (amount * 1_000_i128) / 10_000_000_i128;
        env.events().publish(
            (EVT_DONATION,),
            (campaign_id, donor, amount, care_minted, env.ledger().timestamp()),
        );
    }

    // ── Milestones ────────────────────────────────────────────────────────────

    pub fn add_milestone(env: Env, campaign_id: u32, amount: i128) {
        if amount <= 0 {
            panic!("MF: milestone amount must be > 0");
        }
        let campaign = Self::get_active_campaign(&env, campaign_id);
        campaign.creator.require_auth();

        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::MilestoneCount(campaign_id))
            .unwrap_or(0);

        let mut total: i128 = 0;
        for i in 0..count {
            let m: Milestone = env
                .storage()
                .persistent()
                .get(&DataKey::Milestone(campaign_id, i))
                .unwrap();
            total += m.amount;
        }
        if total + amount > campaign.target_amount {
            panic!("MF: milestones exceed target");
        }

        let milestone = Milestone { amount, approved: false, released: false, approval_count: 0 };
        env.storage().persistent().set(&DataKey::Milestone(campaign_id, count), &milestone);
        env.storage().persistent().set(&DataKey::MilestoneCount(campaign_id), &(count + 1));

        env.events().publish((EVT_MILESTONE_ADDED,), (campaign_id, count, amount));
    }

    pub fn approve_milestone(env: Env, approver: Address, campaign_id: u32, milestone_index: u32) {
        approver.require_auth();

        let campaign = Self::get_active_campaign(&env, campaign_id);
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

        if approver != campaign.creator && approver != campaign.hospital && approver != admin {
            panic!("MF: not an approver");
        }

        let count: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::MilestoneCount(campaign_id))
            .unwrap_or(0);
        if milestone_index >= count {
            panic!("MF: milestone not found");
        }

        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_index))
            .unwrap();

        if milestone.released {
            panic!("MF: already released");
        }

        let approved_key = DataKey::HasApproved(campaign_id, milestone_index, approver.clone());
        if env.storage().persistent().get::<_, bool>(&approved_key).unwrap_or(false) {
            panic!("MF: already approved by you");
        }

        env.storage().persistent().set(&approved_key, &true);
        milestone.approval_count += 1;
        if milestone.approval_count >= APPROVAL_THRESHOLD {
            milestone.approved = true;
        }
        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_index), &milestone);

        env.events().publish(
            (EVT_MILESTONE_APPROVED,),
            (campaign_id, milestone_index, approver, milestone.approval_count),
        );
    }

    pub fn release_milestone(env: Env, caller: Address, campaign_id: u32, milestone_index: u32) {
        caller.require_auth();

        let mut campaign = Self::get_active_campaign(&env, campaign_id);
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

        if caller != campaign.creator && caller != campaign.hospital && caller != admin {
            panic!("MF: not an approver");
        }

        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&DataKey::Milestone(campaign_id, milestone_index))
            .expect("MF: milestone not found");

        if !milestone.approved { panic!("MF: milestone not approved"); }
        if milestone.released  { panic!("MF: already released"); }
        if campaign.total_raised - campaign.total_released < milestone.amount {
            panic!("MF: insufficient campaign balance");
        }

        milestone.released = true;
        campaign.total_released += milestone.amount;
        env.storage().persistent().set(&DataKey::Milestone(campaign_id, milestone_index), &milestone);
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        let xlm_token: Address = env.storage().instance().get(&DataKey::XlmToken).unwrap();
        let token_client = token::Client::new(&env, &xlm_token);
        token_client.transfer(&env.current_contract_address(), &campaign.hospital, &milestone.amount);

        env.events().publish(
            (EVT_MILESTONE_RELEASED,),
            (campaign_id, milestone_index, campaign.hospital, milestone.amount, env.ledger().timestamp()),
        );
    }

    pub fn close_campaign(env: Env, caller: Address, campaign_id: u32) {
        caller.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("MF: campaign not found");

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != campaign.creator && caller != admin { panic!("MF: not authorized"); }
        if !campaign.active { panic!("MF: already closed"); }

        campaign.active = false;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);
        env.events().publish((EVT_CAMPAIGN_CLOSED,), (campaign_id, env.ledger().timestamp()));
    }

    // ── View Functions ────────────────────────────────────────────────────────

    pub fn get_campaign(env: Env, campaign_id: u32) -> Campaign {
        env.storage().persistent().get(&DataKey::Campaign(campaign_id)).expect("MF: campaign not found")
    }

    pub fn get_milestone(env: Env, campaign_id: u32, milestone_index: u32) -> Milestone {
        env.storage().persistent().get(&DataKey::Milestone(campaign_id, milestone_index)).expect("MF: milestone not found")
    }

    pub fn has_approved(env: Env, campaign_id: u32, milestone_index: u32, approver: Address) -> bool {
        env.storage().persistent().get(&DataKey::HasApproved(campaign_id, milestone_index, approver)).unwrap_or(false)
    }

    pub fn get_donors(env: Env, campaign_id: u32) -> Vec<Address> {
        env.storage().persistent().get(&DataKey::Donors(campaign_id)).unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_donation(env: Env, campaign_id: u32, donor: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Donation(campaign_id, donor)).unwrap_or(0)
    }

    pub fn get_progress(env: Env, campaign_id: u32) -> u32 {
        let campaign: Campaign = env.storage().persistent().get(&DataKey::Campaign(campaign_id)).expect("MF: campaign not found");
        if campaign.target_amount == 0 { return 0; }
        let pct = (campaign.total_raised * 100) / campaign.target_amount;
        if pct > 100 { 100 } else { pct as u32 }
    }

    pub fn campaign_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::CampaignCount).unwrap_or(0)
    }

    pub fn milestone_count(env: Env, campaign_id: u32) -> u32 {
        env.storage().persistent().get(&DataKey::MilestoneCount(campaign_id)).unwrap_or(0)
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    fn get_active_campaign(env: &Env, campaign_id: u32) -> Campaign {
        let campaign: Campaign = env
            .storage()
            .persistent()
            .get(&DataKey::Campaign(campaign_id))
            .expect("MF: campaign not found");
        if !campaign.active { panic!("MF: campaign not active"); }
        campaign
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{token, Env};

    struct TestEnv {
        env: Env,
        mf_client: MedicalFundClient<'static>,
        hv_client: hospital_verification::HospitalVerificationClient<'static>,
        ct_client: care_token::CareTokenClient<'static>,
        xlm_token: Address,
        admin: Address,
        creator: Address,
        patient: Address,
        hospital: Address,
        donor: Address,
    }

    fn setup() -> TestEnv {
        let env = Env::default();
        env.mock_all_auths();

        let xlm_admin = Address::generate(&env);
        let xlm_token = env.register_stellar_asset_contract_v2(xlm_admin.clone()).address();

        let hv_id = env.register_contract(None, hospital_verification::HospitalVerification);
        let hv_client = hospital_verification::HospitalVerificationClient::new(&env, &hv_id);

        let ct_id = env.register_contract(None, care_token::CareToken);
        let ct_client = care_token::CareTokenClient::new(&env, &ct_id);

        let mf_id = env.register_contract(None, MedicalFund);
        let mf_client = MedicalFundClient::new(&env, &mf_id);

        let admin   = Address::generate(&env);
        let creator = Address::generate(&env);
        let patient = Address::generate(&env);
        let hospital = Address::generate(&env);
        let donor   = Address::generate(&env);

        hv_client.initialize(&admin);
        ct_client.initialize(&admin);
        ct_client.set_minter(&mf_id);
        mf_client.initialize(&admin, &hv_id, &ct_id, &xlm_token);
        hv_client.add_hospital(&hospital);

        let xlm_client = token::StellarAssetClient::new(&env, &xlm_token);
        xlm_client.mint(&donor, &100_0000000_i128);

        TestEnv { env, mf_client, hv_client, ct_client, xlm_token, admin, creator, patient, hospital, donor }
    }

    #[test]
    fn test_create_campaign() {
        let t = setup();
        let id = t.mf_client.create_campaign(&t.creator, &t.patient, &t.hospital, &10_0000000_i128);
        assert_eq!(id, 0);
        assert_eq!(t.mf_client.campaign_count(), 1);
        let c = t.mf_client.get_campaign(&0);
        assert_eq!(c.creator, t.creator);
        assert!(c.active);
    }

    #[test]
    #[should_panic(expected = "MF: hospital not verified")]
    fn test_create_campaign_unverified_hospital() {
        let t = setup();
        let stranger = Address::generate(&t.env);
        t.mf_client.create_campaign(&t.creator, &t.patient, &stranger, &10_0000000_i128);
    }

    #[test]
    fn test_donate_updates_balance_and_mints_care() {
        let t = setup();
        t.mf_client.create_campaign(&t.creator, &t.patient, &t.hospital, &10_0000000_i128);
        t.mf_client.donate(&t.donor, &0, &1_0000000_i128);
        let c = t.mf_client.get_campaign(&0);
        assert_eq!(c.total_raised, 1_0000000_i128);
        assert_eq!(t.ct_client.balance(&t.donor), 1_000_i128);
    }

    #[test]
    fn test_milestone_full_flow() {
        let t = setup();
        t.mf_client.create_campaign(&t.creator, &t.patient, &t.hospital, &10_0000000_i128);
        t.mf_client.donate(&t.donor, &0, &2_0000000_i128);
        t.mf_client.add_milestone(&0, &2_0000000_i128);
        t.mf_client.approve_milestone(&t.creator, &0, &0);
        t.mf_client.approve_milestone(&t.hospital, &0, &0);
        let m = t.mf_client.get_milestone(&0, &0);
        assert!(m.approved);
        let xlm_client = token::Client::new(&t.env, &t.xlm_token);
        let before = xlm_client.balance(&t.hospital);
        t.mf_client.release_milestone(&t.creator, &0, &0);
        let after = xlm_client.balance(&t.hospital);
        assert_eq!(after - before, 2_0000000_i128);
        assert!(t.mf_client.get_milestone(&0, &0).released);
    }

    #[test]
    #[should_panic(expected = "MF: already approved by you")]
    fn test_double_approval_panics() {
        let t = setup();
        t.mf_client.create_campaign(&t.creator, &t.patient, &t.hospital, &10_0000000_i128);
        t.mf_client.donate(&t.donor, &0, &2_0000000_i128);
        t.mf_client.add_milestone(&0, &2_0000000_i128);
        t.mf_client.approve_milestone(&t.creator, &0, &0);
        t.mf_client.approve_milestone(&t.creator, &0, &0);
    }

    #[test]
    fn test_get_progress() {
        let t = setup();
        t.mf_client.create_campaign(&t.creator, &t.patient, &t.hospital, &10_0000000_i128);
        t.mf_client.donate(&t.donor, &0, &5_0000000_i128);
        assert_eq!(t.mf_client.get_progress(&0), 50);
    }

    #[test]
    fn test_close_campaign() {
        let t = setup();
        t.mf_client.create_campaign(&t.creator, &t.patient, &t.hospital, &10_0000000_i128);
        t.mf_client.close_campaign(&t.creator, &0);
        assert!(!t.mf_client.get_campaign(&0).active);
    }
}
