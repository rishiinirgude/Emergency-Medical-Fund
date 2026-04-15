"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AlertCircle, ArrowLeft, Heart, Loader2 } from "lucide-react";
import Link from "next/link";
import { nativeToScVal, Address } from "@stellar/stellar-sdk";
import { useWallet } from "@/context/WalletContext";
import { invokeContract, contracts } from "@/hooks/useContracts";
import TransactionStatus from "@/components/TransactionStatus";

type TxStatus = "idle" | "pending" | "success" | "error";

// 1 XLM = 10_000_000 stroops
function xlmToStroops(xlm: string): bigint {
  return BigInt(Math.round(parseFloat(xlm) * 10_000_000));
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const { address, connected, signTx } = useWallet();

  const [form, setForm] = useState({
    patientAddress: "",
    hospitalAddress: "",
    targetAmount: "",
  });
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    // Stellar addresses are 56-char base32 starting with G
    if (!form.patientAddress.match(/^G[A-Z2-7]{55}$/))
      errs.patientAddress = "Invalid Stellar address (starts with G, 56 chars)";
    if (!form.hospitalAddress.match(/^G[A-Z2-7]{55}$/))
      errs.hospitalAddress = "Invalid Stellar address (starts with G, 56 chars)";
    if (!form.targetAmount || parseFloat(form.targetAmount) <= 0)
      errs.targetAmount = "Target must be greater than 0";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !address) {
      toast.error("Please connect your Freighter wallet first");
      return;
    }

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    try {
      setTxStatus("pending");

      const stroops = xlmToStroops(form.targetAmount);

      await invokeContract(
        contracts.medicalFund,
        "create_campaign",
        [
          new Address(address).toScVal(),
          new Address(form.patientAddress).toScVal(),
          new Address(form.hospitalAddress).toScVal(),
          nativeToScVal(stroops, { type: "i128" }),
        ],
        address,
        signTx
      );

      setTxStatus("success");
      toast.success("Campaign created on Stellar!");
      setTimeout(() => router.push("/"), 2000);
    } catch (err: unknown) {
      setTxStatus("error");
      const msg = err instanceof Error ? err.message : "Transaction failed";
      if (msg.includes("hospital not verified")) {
        toast.error("Hospital address is not verified on-chain");
      } else if (msg.includes("rejected") || msg.includes("cancel")) {
        toast.error("Transaction cancelled");
        setTxStatus("idle");
      } else {
        toast.error("Transaction failed — check console");
      }
      console.error(err);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" />
        Back to campaigns
      </Link>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Create Campaign</h1>
            <p className="text-sm text-gray-500">Powered by Stellar / Soroban</p>
          </div>
        </div>

        {!connected && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-700">Connect your Freighter wallet to create a campaign.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Patient Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="G..."
              value={form.patientAddress}
              onChange={(e) => setForm({ ...form, patientAddress: e.target.value })}
              className={`input-field ${errors.patientAddress ? "border-red-400" : ""}`}
            />
            {errors.patientAddress && (
              <p className="text-red-500 text-xs mt-1">{errors.patientAddress}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Stellar address of the patient (beneficiary)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Hospital Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="G..."
              value={form.hospitalAddress}
              onChange={(e) => setForm({ ...form, hospitalAddress: e.target.value })}
              className={`input-field ${errors.hospitalAddress ? "border-red-400" : ""}`}
            />
            {errors.hospitalAddress && (
              <p className="text-red-500 text-xs mt-1">{errors.hospitalAddress}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Must be a verified hospital (checked on-chain)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Target Amount (XLM) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.0000001"
                min="0.0000001"
                placeholder="e.g. 500"
                value={form.targetAmount}
                onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
                className={`input-field pr-14 ${errors.targetAmount ? "border-red-400" : ""}`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                XLM
              </span>
            </div>
            {errors.targetAmount && (
              <p className="text-red-500 text-xs mt-1">{errors.targetAmount}</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-medium mb-1">How it works</p>
            <ul className="space-y-1 text-blue-600 text-xs list-disc list-inside">
              <li>Hospital verified on-chain via HospitalVerification contract</li>
              <li>Donors receive CARE tokens as rewards (1000 CARE per 1 XLM)</li>
              <li>Funds released per milestone after 2-of-3 approvals</li>
              <li>All transactions on Stellar Testnet</li>
            </ul>
          </div>

          <TransactionStatus status={txStatus} txHash={txHash} />

          <button
            type="submit"
            disabled={!connected || txStatus === "pending" || txStatus === "success"}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {txStatus === "pending" ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Creating Campaign...</>
            ) : txStatus === "success" ? (
              "Campaign Created! Redirecting..."
            ) : (
              "Create Campaign"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
