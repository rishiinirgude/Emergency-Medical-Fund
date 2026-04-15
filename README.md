# 🚑 Emergency Medical Fund Wallet

[![CI/CD Pipeline](https://github.com/your-username/emergency-medical-fund/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/emergency-medical-fund/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Rust](https://img.shields.io/badge/Rust-1.75+-orange)](https://www.rust-lang.org/)
[![Soroban](https://img.shields.io/badge/Soroban-21.0-blue)](https://soroban.stellar.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)

> Transparent, trustless crowdfunding for emergency medical expenses — powered by Stellar/Soroban.

---

## 🔗 Live Demo

**[https://emergency-medical-fund.vercel.app](https://emergency-medical-fund.vercel.app)**

> Connect MetaMask to Sepolia testnet to interact with the live contracts.

---

## 📱 Mobile Responsive View

![Mobile View](./docs/screenshots/mobile-view.png)

> The UI is fully responsive across all screen sizes — from 320px mobile to 1440px desktop.

---

## ⚙️ CI/CD Pipeline

![CI/CD Pipeline](https://github.com/your-username/emergency-medical-fund/actions/workflows/ci.yml/badge.svg)

![CI/CD Screenshot](./docs/screenshots/cicd-pipeline.png)

The pipeline runs on every push to `main` and every pull request:

| Job | What it does |
|---|---|
| Smart Contracts | `cargo test`, WASM build, contract size check |
| Frontend | Builds Next.js app, ESLint |
| Security Audit | `cargo audit` + `npm audit` |
| Deploy | Auto-deploys to Vercel on `main` merge |

---

## 📋 Contract Addresses (Stellar Testnet)

| Contract | Contract ID |
|---|---|
| `hospital_verification` | `C...` |
| `medical_fund` | `C...` |
| `care_token` (CARE token) | `C...` |

> Replace with real contract IDs after running `./scripts/deploy.sh testnet`.

### Token

| Token | Symbol | Contract ID |
|---|---|---|
| CareToken | `CARE` | `C...` |

Rate: **1000 CARE per 1 XLM** donated.

### Inter-Contract Call Transaction Hashes

| Action | Tx Hash |
|---|---|
| Deploy hospital_verification | `...` |
| Deploy care_token | `...` |
| Deploy medical_fund | `...` |
| Wire care_token minter → medical_fund | `...` |
| Create Campaign (calls `is_verified()`) | `...` |
| Donate (calls `mint_reward()`) | `...` |
| Release Milestone (XLM transfer) | `...` |

> View all transactions on [Stellar Expert Testnet](https://stellar.expert/explorer/testnet).

---

## Problem Statement

Medical emergencies create financial crises overnight. Traditional crowdfunding platforms:
- Lack transparency on fund usage
- Have no guarantee funds reach the hospital
- Charge high platform fees
- Provide no accountability mechanism

## Solution

**Emergency Medical Fund Wallet** is a decentralized application where:
- Funds are held in a smart contract, not by any company
- Hospitals must be **verified on-chain** before receiving funds
- Money is released **per milestone** only after **2-of-3 multi-sig approval**
- Every transaction is publicly auditable on Ethereum
- Donors receive **CARE tokens** as proof of contribution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Home    │  │ Create Camp. │  │  Campaign Detail       │ │
│  │ (list)   │  │  (form)      │  │  (donate/approve/      │ │
│  └──────────┘  └──────────────┘  │   release milestones)  │ │
│                                  └────────────────────────┘ │
│                    Wagmi + RainbowKit + Viem                 │
└─────────────────────────────┬───────────────────────────────┘
                              │ RPC calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Ethereum Sepolia Testnet                   │
│                                                              │
│  ┌──────────────────────────┐                               │
│  │  HospitalVerification    │◄──── Inter-contract call ─┐  │
│  │  (Ownable whitelist)     │                            │  │
│  └──────────────────────────┘                            │  │
│                                                          │  │
│  ┌──────────────────────────┐    ┌──────────────────┐   │  │
│  │      MedicalFund         │───►│    CareToken     │   │  │
│  │  (campaigns, donations,  │    │  (ERC-20 reward) │   │  │
│  │   milestones, multisig)  │    └──────────────────┘   │  │
│  └──────────────────────────┘────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts (Rust / Soroban)

All contracts are written in **Rust** using the **Soroban SDK** and deployed on **Stellar Testnet**.

### hospital_verification
Maintains an on-chain whitelist of verified hospital addresses. Only the admin can add or remove hospitals. Other contracts call `is_verified()` to gate-keep campaign creation.

| Function | Access | Description |
|---|---|---|
| `initialize(admin)` | Once | Set contract admin |
| `add_hospital(hospital)` | Admin only | Whitelist a hospital |
| `remove_hospital(hospital)` | Admin only | Remove from whitelist |
| `is_verified(hospital)` | Public | Check verification status |
| `get_hospitals()` | Public | List all verified hospitals |
| `hospital_count()` | Public | Total verified hospitals |

### medical_fund
Core contract handling the full campaign lifecycle.

| Function | Access | Description |
|---|---|---|
| `create_campaign(creator, patient, hospital, target)` | Anyone | Create campaign (calls hospital_verification) |
| `donate(donor, campaign_id, amount)` | Anyone | Send XLM, receive CARE tokens |
| `add_milestone(campaign_id, amount)` | Creator | Add a fund release milestone |
| `approve_milestone(approver, campaign_id, index)` | Creator/Hospital/Admin | Approve milestone (2-of-3 required) |
| `release_milestone(caller, campaign_id, index)` | Creator/Hospital/Admin | Transfer XLM to hospital |
| `close_campaign(caller, campaign_id)` | Creator/Admin | Close campaign |

### care_token
SEP-41 compatible fungible token. Minted automatically on donations.

| Detail | Value |
|---|---|
| Name | CareToken |
| Symbol | CARE |
| Decimals | 7 (Stellar standard) |
| Rate | 1000 CARE per 1 XLM donated |
| Minter | medical_fund contract (set post-deploy) |

---

## Security Features

- **ReentrancyGuard** on all ETH transfer functions
- **Checks-Effects-Interactions** pattern throughout
- **Role-based modifiers** for access control
- **Input validation** on all public functions
- **Double-spend prevention** via `released` flag
- **Double-approval prevention** via per-address tracking

---

## Project Structure

```
emergency-medical-fund/
├── contracts/
│   ├── hospital_verification/     # Rust Soroban — hospital whitelist
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   ├── care_token/                # Rust Soroban — SEP-41 CARE token
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   └── medical_fund/              # Rust Soroban — core crowdfunding logic
│       ├── src/lib.rs
│       └── Cargo.toml
├── scripts/
│   └── deploy.sh                  # Stellar CLI deploy + wiring script
├── frontend/
│   └── src/
│       ├── app/                   # Next.js App Router pages
│       │   ├── page.tsx           # Home – campaign list
│       │   ├── create/page.tsx    # Create campaign form
│       │   ├── campaign/[id]/     # Campaign detail + donate
│       │   └── admin/page.tsx     # Hospital admin panel
│       ├── components/            # Reusable UI components
│       ├── context/               # Freighter wallet context
│       ├── hooks/                 # Soroban contract hooks
│       ├── config/                # Stellar RPC config, contract IDs
│       └── lib/                   # Utilities
├── docs/screenshots/              # Mobile + CI/CD screenshots
├── .github/workflows/ci.yml       # GitHub Actions CI/CD
├── Cargo.toml                     # Rust workspace
├── .env.example
└── README.md
```

---

## Setup & Installation

### Prerequisites
- [Rust](https://rustup.rs/) >= 1.75 with `wasm32-unknown-unknown` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli) >= 21.0
- [Freighter wallet](https://freighter.app/) browser extension
- Node.js >= 18

### 1. Clone & Install

```bash
git clone https://github.com/your-username/emergency-medical-fund.git
cd emergency-medical-fund

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in STELLAR_SECRET_KEY
```

### 3. Run Contract Tests

```bash
cargo test --workspace
```

### 4. Build Contracts

```bash
cargo build --target wasm32-unknown-unknown --release --workspace
```

### 5. Deploy Contracts

```bash
# Fund your testnet account first
stellar keys generate --global deployer --network testnet
stellar keys fund deployer --network testnet

# Deploy all 3 contracts
chmod +x scripts/deploy.sh
./scripts/deploy.sh testnet
```

After deployment, contract IDs are written to `frontend/src/config/contracts.json`.

### 6. Run Frontend

```bash
cd frontend
npm run dev
# Open http://localhost:3000
# Connect Freighter wallet set to Stellar Testnet
```

---

## Deployment Guide (Vercel)

1. Push code to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Set **Root Directory** to `frontend`
4. Add environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

5. Deploy — Vercel auto-deploys on every push to `main`

### Vercel Secrets for CI/CD Auto-Deploy

Add these to your GitHub repository secrets (`Settings → Secrets → Actions`):

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `vercel link` |

---

## Git Commit History

This project maintains a meaningful commit history. Key commits:

| # | Commit Message |
|---|---|
| 1 | `feat: initial project scaffold with Stellar/Soroban + Next.js` |
| 2 | `feat: implement hospital_verification Soroban contract in Rust` |
| 3 | `feat: implement care_token SEP-41 Soroban contract in Rust` |
| 4 | `feat: implement medical_fund core contract with milestone multisig` |
| 5 | `feat: add Stellar CLI deploy script with contract wiring` |
| 6 | `feat: build Next.js frontend with Freighter wallet integration` |
| 7 | `feat: add campaign detail page with donate and milestone UI` |
| 8 | `feat: add admin panel for hospital verification management` |
| 9 | `fix: replace all EVM references with Stellar/XLM throughout frontend` |
| 10 | `ci: add GitHub Actions CI/CD with Rust tests and Vercel deploy` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Rust, Soroban SDK 21.0 |
| Contract Framework | Stellar CLI |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Wallet | Freighter (Stellar wallet) |
| Stellar SDK | @stellar/stellar-sdk, @stellar/freighter-api |
| Testing | Rust built-in tests + Soroban testutils |
| CI/CD | GitHub Actions |
| Hosting | Vercel |
| Network | Stellar Testnet |

---

## License

MIT © 2024 Emergency Medical Fund Wallet
