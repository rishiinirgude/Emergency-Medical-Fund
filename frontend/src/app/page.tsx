"use client";

import { useCampaigns } from "@/hooks/useCampaigns";
import CampaignCard from "@/components/CampaignCard";
import StatsBar from "@/components/StatsBar";
import Link from "next/link";
import { Heart, Loader2, Plus, AlertCircle } from "lucide-react";
import { stroopsToXlm } from "@/lib/utils";

export default function HomePage() {
  const { campaigns, loading, error, refetch } = useCampaigns();

  const activeCampaigns = campaigns.filter((c) => c.active);
  const totalRaisedStroops = campaigns.reduce((sum, c) => sum + c.totalRaised, 0n);

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-sm font-medium px-4 py-2 rounded-full mb-4">
          <Heart className="w-4 h-4 fill-red-500" />
          Powered by Stellar / Soroban
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
          Emergency Medical
          <span className="text-red-600"> Fund Wallet</span>
        </h1>
        <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-6">
          Transparent, trustless crowdfunding for medical emergencies. Funds are
          held on-chain and released to verified hospitals only after milestone
          approvals.
        </p>
        <Link href="/create">
          <button className="btn-primary inline-flex items-center gap-2 text-base px-6 py-3">
            <Plus className="w-5 h-5" />
            Start a Campaign
          </button>
        </Link>
      </div>

      {/* Stats */}
      <StatsBar
        totalCampaigns={campaigns.length}
        activeCampaigns={activeCampaigns.length}
        totalRaisedXlm={stroopsToXlm(totalRaisedStroops)}
      />

      {/* Campaign Grid */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">
          {activeCampaigns.length > 0
            ? `${activeCampaigns.length} Active Campaign${activeCampaigns.length !== 1 ? "s" : ""}`
            : "All Campaigns"}
        </h2>
        <button
          onClick={refetch}
          className="text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-gray-500 text-sm">Loading campaigns from Stellar...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Failed to load campaigns</p>
            <p className="text-sm text-red-500 mt-0.5">
              Make sure the contracts are deployed on Stellar Testnet.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <div className="text-center py-20">
          <Heart className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No campaigns yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Be the first to create a medical fund campaign.
          </p>
          <Link href="/create">
            <button className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Campaign
            </button>
          </Link>
        </div>
      )}

      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
