"use client";

import Link from "next/link";
import { Heart, Hospital, Target, TrendingUp } from "lucide-react";
import { Campaign } from "@/hooks/useCampaigns";
import { shortenAddress, formatDate } from "@/lib/utils";

interface Props {
  campaign: Campaign;
}

export default function CampaignCard({ campaign }: Props) {
  const progressColor =
    campaign.progress >= 100
      ? "bg-green-500"
      : campaign.progress >= 50
      ? "bg-blue-500"
      : "bg-red-500";

  return (
    <Link href={`/campaign/${campaign.id}`}>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group cursor-pointer">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-red-500 to-rose-600 h-3" />

        <div className="p-5">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-3">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                campaign.active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {campaign.active ? "● Active" : "● Closed"}
            </span>
            <span className="text-xs text-gray-400">
              {formatDate(campaign.createdAt)}
            </span>
          </div>

          {/* Campaign ID */}
          <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-red-600 transition-colors">
            Campaign #{campaign.id}
          </h3>

          {/* Addresses */}
          <div className="space-y-1.5 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Heart className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span>Patient: {shortenAddress(campaign.patient)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Hospital className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span>Hospital: {shortenAddress(campaign.hospital)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-semibold text-gray-800">
                {campaign.raisedXlm} XLM raised
              </span>
              <span className="text-gray-500">{campaign.progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${progressColor}`}
                style={{ width: `${Math.min(campaign.progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Target */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-gray-500">
              <Target className="w-3.5 h-3.5" />
              <span>Goal: {campaign.targetXlm} XLM</span>
            </div>
            <div className="flex items-center gap-1 text-medical-blue text-xs font-medium text-blue-600">
              <TrendingUp className="w-3.5 h-3.5" />
              View Details →
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
