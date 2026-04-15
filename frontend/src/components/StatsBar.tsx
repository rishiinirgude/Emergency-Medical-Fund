"use client";

import { Heart, Hospital, TrendingUp, Users } from "lucide-react";

interface Props {
  totalCampaigns: number;
  activeCampaigns: number;
  totalRaisedXlm: string;
}

export default function StatsBar({ totalCampaigns, activeCampaigns, totalRaisedXlm }: Props) {
  const stats = [
    { label: "Total Campaigns", value: totalCampaigns, icon: Heart, color: "text-red-500" },
    { label: "Active Campaigns", value: activeCampaigns, icon: TrendingUp, color: "text-green-500" },
    { label: "XLM Raised", value: `${totalRaisedXlm} XLM`, icon: Users, color: "text-blue-500" },
    { label: "Verified Hospitals", value: "On-chain", icon: Hospital, color: "text-purple-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
            <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
