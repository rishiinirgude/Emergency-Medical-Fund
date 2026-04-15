"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { nativeToScVal, Address } from "@stellar/stellar-sdk";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  ArrowLeft, Heart, Hospital, Loader2, Plus, User, AlertCircle,
} from "lucide-react";
import { useCampaigns, useCampaignMilestones } from "@/hooks/useCampaigns";
import MilestoneCard from "@/components/MilestoneCard";
import TransactionStatus from "@/components/TransactionStatus";
import { shortenAddress, formatDate, stroopsToXlm } from "@/lib/utils";
import { invokeContract, readContract, contracts } from "@/hooks/useContracts";
import { useWallet } from "@/context/WalletContext";

type TxStatus = "idle" | "pending" | "success" | "error";

function xlmToStroops(xlm: string): bigint {
  return BigInt(Math.round(parseFloat(xlm) * 10_000_000));
}

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = parseInt(params.id as string);

  const { address, connected, signTx } = useWallet();
  const { campaigns, loading: campaignsLoading, refetch: refetchCampaigns } = useCampaigns();
  const { milestones, loading: milestonesLoading, refetch: refetchMilestones } = useCampaignMilestones(campaignId);

  const campaign = campaigns.find((c) => c.id === campaignId);

  const [donationAmount, setDonationAmount] = useState("");
  const [milestoneAmount, setMilestoneAmount] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string>();
  const [approvedMap, setApprovedMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!address || milestones.length === 0) return;
    (async () => {
      const map: Record<number, boolean> = {};
      for (const m of milestones) {
        const approved = await readContract(contracts.medicalFund, "has_approved", [
          nativeToScVal(campaignId, { type: "u32" }),
          nativeToScVal(m.index, { type: "u32" }),
          new Address(address).toScVal(),
        ]);
        map[m.index] = approved as boolean;
      }
      setApprovedMap(map);
    })();
  }, [address, milestones, campaignId]);

  const isCreator = !!address && address === campaign?.creator;
  const isHospital = !!address && address === campaign?.hospital;
  const canApprove = isCreator || isHospital;

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !address) { toast.error("Connect Freighter wallet first"); return; }
    if (!donationAmount || parseFloat(donationAmount) <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      setTxStatus("pending");
      await invokeContract(
        contracts.medicalFund,
        "donate",
        [
          new Address(address).toScVal(),
          nativeToScVal(campaignId, { type: "u32" }),
          nativeToScVal(xlmToStroops(donationAmount), { type: "i128" }),
        ],
        address,
        signTx
      );
      setTxStatus("success");
      toast.success(`Donated ${donationAmount} XLM! You earned CARE tokens 🎉`);
      setDonationAmount("");
      refetchCampaigns();
    } catch (err: unknown) {
      setTxStatus("error");
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("cancel") || msg.includes("rejected")) { setTxStatus("idle"); toast.error("Cancelled"); }
      else toast.error("Donation failed");
    }
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    if (!connected || !address) return;
    if (!milestoneAmount || parseFloat(milestoneAmount) <= 0) { toast.error("Enter a valid amount"); return; }
    try {
      setTxStatus("pending");
      await invokeContract(
        contracts.medicalFund,
        "add_milestone",
        [
          nativeToScVal(campaignId, { type: "u32" }),
          nativeToScVal(xlmToStroops(milestoneAmount), { type: "i128" }),
        ],
        address,
        signTx
      );
      setTxStatus("success");
      toast.success("Milestone added!");
      setMilestoneAmount("");
      refetchMilestones();
    } catch (err) {
      setTxStatus("error");
      toast.error("Failed to add milestone");
      console.error(err);
    }
  }

  async function handleApprove(milestoneIndex: number) {
    if (!connected || !address) return;
    try {
      setTxStatus("pending");
      await invokeContract(
        contracts.medicalFund,
        "approve_milestone",
        [
          new Address(address).toScVal(),
          nativeToScVal(campaignId, { type: "u32" }),
          nativeToScVal(milestoneIndex, { type: "u32" }),
        ],
        address,
        signTx
      );
      setTxStatus("success");
      toast.success("Milestone approved!");
      refetchMilestones();
    } catch (err) {
      setTxStatus("error");
      toast.error("Approval failed");
      console.error(err);
    }
  }

  async function handleRelease(milestoneIndex: number) {
    if (!connected || !address) return;
    try {
      setTxStatus("pending");
      await invokeContract(
        contracts.medicalFund,
        "release_milestone",
        [
          new Address(address).toScVal(),
          nativeToScVal(campaignId, { type: "u32" }),
          nativeToScVal(milestoneIndex, { type: "u32" }),
        ],
        address,
        signTx
      );
      setTxStatus("success");
      toast.success("Funds released to hospital!");
      refetchCampaigns();
      refetchMilestones();
    } catch (err) {
      setTxStatus("error");
      toast.error("Release failed");
      console.error(err);
    }
  }

  if (campaignsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        <p className="text-gray-500 text-sm">Loading campaign from Stellar...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Campaign not found</p>
        <Link href="/"><button className="btn-secondary mt-4">Back to campaigns</button></Link>
      </div>
    );
  }

  const progressColor = campaign.progress >= 100 ? "bg-green-500" : campaign.progress >= 50 ? "bg-blue-500" : "bg-red-500";

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" />All campaigns
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${campaign.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {campaign.active ? "● Active" : "● Closed"}
              </span>
              <span className="text-xs text-gray-400">Created {formatDate(campaign.createdAt)}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Campaign #{campaign.id}</h1>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: "Creator", value: campaign.creator, icon: User, color: "text-purple-500" },
                { label: "Patient", value: campaign.patient, icon: Heart, color: "text-red-500" },
                { label: "Hospital", value: campaign.hospital, icon: Hospital, color: "text-blue-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                    <span className="text-xs text-gray-500 font-medium">{label}</span>
                  </div>
                  <p className="text-sm font-mono text-gray-700 truncate">{shortenAddress(value, 6)}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-bold text-gray-900 text-lg">{campaign.raisedXlm} XLM</span>
                <span className="text-gray-500">of {campaign.targetXlm} XLM goal</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-1">
                <div className={`h-3 rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${Math.min(campaign.progress, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>{campaign.progress}% funded</span>
                <span>Released: {stroopsToXlm(campaign.totalReleased)} XLM</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Milestones</h2>
              <span className="text-sm text-gray-400">{milestones.length} milestone{milestones.length !== 1 ? "s" : ""}</span>
            </div>

            {milestonesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
            ) : milestones.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No milestones added yet.</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((m) => (
                  <MilestoneCard
                    key={m.index}
                    milestone={m}
                    campaignId={campaignId}
                    onApprove={handleApprove}
                    onRelease={handleRelease}
                    canApprove={canApprove}
                    hasApproved={approvedMap[m.index] ?? false}
                    loading={txStatus === "pending"}
                  />
                ))}
              </div>
            )}

            {isCreator && campaign.active && (
              <form onSubmit={handleAddMilestone} className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-2">Add Milestone</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number" step="0.0000001" min="0.0000001" placeholder="Amount in XLM"
                      value={milestoneAmount} onChange={(e) => setMilestoneAmount(e.target.value)}
                      className="input-field pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">XLM</span>
                  </div>
                  <button type="submit" disabled={txStatus === "pending"} className="btn-primary flex items-center gap-1.5 px-4">
                    <Plus className="w-4 h-4" />Add
                  </button>
                </div>
              </form>
            )}
          </div>

          {txStatus !== "idle" && <TransactionStatus status={txStatus} txHash={txHash} />}
        </div>

        <div className="space-y-5">
          <div className="card sticky top-24">
            <h2 className="font-bold text-gray-900 mb-4">Support this Campaign</h2>
            {!connected ? (
              <p className="text-gray-500 text-sm text-center py-4">Connect Freighter wallet to donate</p>
            ) : !campaign.active ? (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-gray-500 text-sm">This campaign is closed</p>
              </div>
            ) : (
              <form onSubmit={handleDonate} className="space-y-3">
                <div className="relative">
                  <input
                    type="number" step="0.0000001" min="0.0000001" placeholder="10"
                    value={donationAmount} onChange={(e) => setDonationAmount(e.target.value)}
                    className="input-field pr-14 text-lg font-semibold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">XLM</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["10", "50", "100"].map((amt) => (
                    <button key={amt} type="button" onClick={() => setDonationAmount(amt)} className="btn-secondary text-sm py-2 px-2">
                      {amt} XLM
                    </button>
                  ))}
                </div>
                <button type="submit" disabled={txStatus === "pending"} className="btn-primary w-full flex items-center justify-center gap-2">
                  {txStatus === "pending" ? <><Loader2 className="w-4 h-4 animate-spin" />Donating...</> : <><Heart className="w-4 h-4" />Donate</>}
                </button>
                <p className="text-xs text-gray-400 text-center">You&apos;ll receive CARE tokens as a reward</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
