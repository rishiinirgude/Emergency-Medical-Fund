"use client";

import { CheckCircle, Clock, Lock, Unlock } from "lucide-react";
import { Milestone } from "@/hooks/useCampaigns";
import { cn } from "@/lib/utils";

interface Props {
  milestone: Milestone;
  campaignId: number;
  onApprove: (milestoneIndex: number) => void;
  onRelease: (milestoneIndex: number) => void;
  canApprove: boolean;
  hasApproved: boolean;
  loading?: boolean;
}

export default function MilestoneCard({
  milestone,
  onApprove,
  onRelease,
  canApprove,
  hasApproved,
  loading,
}: Props) {
  const statusColor = milestone.released
    ? "border-green-200 bg-green-50"
    : milestone.approved
    ? "border-blue-200 bg-blue-50"
    : "border-gray-200 bg-white";

  return (
    <div className={cn("rounded-xl border p-4 transition-all", statusColor)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {milestone.released ? (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          ) : milestone.approved ? (
            <Unlock className="w-5 h-5 text-blue-500 flex-shrink-0" />
          ) : (
            <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold text-gray-900">
              Milestone #{milestone.index + 1}
            </p>
            <p className="text-sm text-gray-500">{milestone.amountXlm} XLM</p>
          </div>
        </div>

        <span
          className={cn(
            "text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0",
            milestone.released
              ? "bg-green-100 text-green-700"
              : milestone.approved
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600"
          )}
        >
          {milestone.released ? "Released" : milestone.approved ? "Approved" : "Pending"}
        </span>
      </div>

      {!milestone.released && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>{milestone.approvalCount}/2 approvals</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full",
                  i < milestone.approvalCount ? "bg-blue-500" : "bg-gray-200"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {!milestone.released && (
        <div className="mt-3 flex gap-2 flex-wrap">
          {canApprove && !hasApproved && !milestone.approved && (
            <button
              onClick={() => onApprove(milestone.index)}
              disabled={loading}
              className="flex-1 min-w-[100px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
            >
              {loading ? "Approving..." : "Approve"}
            </button>
          )}
          {milestone.approved && canApprove && (
            <button
              onClick={() => onRelease(milestone.index)}
              disabled={loading}
              className="flex-1 min-w-[100px] bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
            >
              {loading ? "Releasing..." : "Release Funds"}
            </button>
          )}
          {hasApproved && !milestone.approved && (
            <span className="text-xs text-blue-600 font-medium py-2">
              ✓ You approved this milestone
            </span>
          )}
        </div>
      )}
    </div>
  );
}
