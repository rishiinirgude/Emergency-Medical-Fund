#!/usr/bin/env bash
# deploy.sh — Deploy all three Soroban contracts to Stellar Testnet
# and write addresses to frontend/src/config/contracts.json
#
# Prerequisites:
#   stellar CLI installed: https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli
#   Funded testnet account: stellar keys generate --global deployer --network testnet
#                           stellar keys fund deployer --network testnet

set -e

NETWORK=${1:-testnet}
DEPLOYER=${STELLAR_DEPLOYER_KEY:-deployer}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚑  Emergency Medical Fund — Soroban Deploy"
echo "    Network : $NETWORK"
echo "    Deployer: $DEPLOYER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Build all contracts ───────────────────────────────────────────────────────
echo ""
echo "Building contracts..."
stellar contract build

# ── 1. Deploy HospitalVerification ───────────────────────────────────────────
echo ""
echo "1/3  Deploying HospitalVerification..."
HV_ADDRESS=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/hospital_verification.wasm \
  --source "$DEPLOYER" \
  --network "$NETWORK")
echo "     ✅ HospitalVerification: $HV_ADDRESS"

# Initialize HospitalVerification
DEPLOYER_ADDRESS=$(stellar keys address "$DEPLOYER")
stellar contract invoke \
  --id "$HV_ADDRESS" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS"
echo "     ✅ HospitalVerification initialized"

# ── 2. Deploy CareToken ───────────────────────────────────────────────────────
echo ""
echo "2/3  Deploying CareToken..."
CT_ADDRESS=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/care_token.wasm \
  --source "$DEPLOYER" \
  --network "$NETWORK")
echo "     ✅ CareToken: $CT_ADDRESS"

stellar contract invoke \
  --id "$CT_ADDRESS" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS"
echo "     ✅ CareToken initialized"

# ── 3. Deploy MedicalFund ─────────────────────────────────────────────────────
echo ""
echo "3/3  Deploying MedicalFund..."

# Native XLM token contract address on testnet
XLM_TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

MF_ADDRESS=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/medical_fund.wasm \
  --source "$DEPLOYER" \
  --network "$NETWORK")
echo "     ✅ MedicalFund: $MF_ADDRESS"

stellar contract invoke \
  --id "$MF_ADDRESS" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --hv_contract "$HV_ADDRESS" \
  --ct_contract "$CT_ADDRESS" \
  --xlm_token "$XLM_TOKEN"
echo "     ✅ MedicalFund initialized"

# ── 4. Wire CareToken minter → MedicalFund ────────────────────────────────────
echo ""
echo "Wiring CareToken minter → MedicalFund..."
stellar contract invoke \
  --id "$CT_ADDRESS" \
  --source "$DEPLOYER" \
  --network "$NETWORK" \
  -- set_minter \
  --new_minter "$MF_ADDRESS"
echo "     ✅ Minter set"

# ── 5. Seed demo hospital (testnet only) ──────────────────────────────────────
if [ "$NETWORK" = "testnet" ] || [ "$NETWORK" = "standalone" ]; then
  echo ""
  echo "Seeding demo hospital..."
  DEMO_HOSPITAL=${DEMO_HOSPITAL_ADDRESS:-$DEPLOYER_ADDRESS}
  stellar contract invoke \
    --id "$HV_ADDRESS" \
    --source "$DEPLOYER" \
    --network "$NETWORK" \
    -- add_hospital \
    --hospital "$DEMO_HOSPITAL"
  echo "     ✅ Demo hospital added: $DEMO_HOSPITAL"
fi

# ── 6. Write addresses to frontend config ─────────────────────────────────────
echo ""
echo "Writing contract addresses to frontend/src/config/contracts.json..."

mkdir -p frontend/src/config
cat > frontend/src/config/contracts.json <<EOF
{
  "network": "$NETWORK",
  "HospitalVerification": "$HV_ADDRESS",
  "CareToken": "$CT_ADDRESS",
  "MedicalFund": "$MF_ADDRESS",
  "XlmToken": "$XLM_TOKEN",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "     ✅ Written to frontend/src/config/contracts.json"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉  Deployment complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "HospitalVerification : $HV_ADDRESS"
echo "CareToken            : $CT_ADDRESS"
echo "MedicalFund          : $MF_ADDRESS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "View on Stellar Expert:"
echo "  https://stellar.expert/explorer/testnet/contract/$MF_ADDRESS"
