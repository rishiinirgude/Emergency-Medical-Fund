import { useEffect, useState, useCallback } from "react";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { readContract, contracts } from "./useContracts";

export interface Campaign {
  id: number;
  creator: string;
  patient: string;
  hospital: string;
  targetAmount: bigint;
  totalRaised: bigint;
  totalReleased: bigint;
  active: boolean;
  createdAt: bigint;
  progress: number;
  targetXlm: string;
  raisedXlm: string;
}

export interface Milestone {
  index: number;
  amount: bigint;
  amountXlm: string;
  approved: boolean;
  released: boolean;
  approvalCount: number;
}

// Convert stroops to XLM string
function stroopsToXlm(stroops: bigint): string {
  return (Number(stroops) / 10_000_000).toFixed(7).replace(/\.?0+$/, "");
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const count = (await readContract(
        contracts.medicalFund,
        "campaign_count",
        []
      )) as number;

      const results: Campaign[] = [];
      for (let i = 0; i < count; i++) {
        const [data, progress] = await Promise.all([
          readContract(contracts.medicalFund, "get_campaign", [
            nativeToScVal(i, { type: "u32" }),
          ]),
          readContract(contracts.medicalFund, "get_progress", [
            nativeToScVal(i, { type: "u32" }),
          ]),
        ]);

        const c = data as {
          creator: string;
          patient: string;
          hospital: string;
          target_amount: bigint;
          total_raised: bigint;
          total_released: bigint;
          active: boolean;
          created_at: bigint;
        };

        results.push({
          id: i,
          creator: c.creator,
          patient: c.patient,
          hospital: c.hospital,
          targetAmount: c.target_amount,
          totalRaised: c.total_raised,
          totalReleased: c.total_released,
          active: c.active,
          createdAt: c.created_at,
          progress: progress as number,
          targetXlm: stroopsToXlm(c.target_amount),
          raisedXlm: stroopsToXlm(c.total_raised),
        });
      }
      setCampaigns(results);
    } catch (err) {
      setError("Failed to load campaigns");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return { campaigns, loading, error, refetch: fetchCampaigns };
}

export function useCampaignMilestones(campaignId: number) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMilestones = useCallback(async () => {
    if (campaignId < 0) return;
    setLoading(true);
    try {
      const count = (await readContract(
        contracts.medicalFund,
        "milestone_count",
        [nativeToScVal(campaignId, { type: "u32" })]
      )) as number;

      const results: Milestone[] = [];
      for (let i = 0; i < count; i++) {
        const data = (await readContract(
          contracts.medicalFund,
          "get_milestone",
          [
            nativeToScVal(campaignId, { type: "u32" }),
            nativeToScVal(i, { type: "u32" }),
          ]
        )) as {
          amount: bigint;
          approved: boolean;
          released: boolean;
          approval_count: number;
        };

        results.push({
          index: i,
          amount: data.amount,
          amountXlm: stroopsToXlm(data.amount),
          approved: data.approved,
          released: data.released,
          approvalCount: data.approval_count,
        });
      }
      setMilestones(results);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  return { milestones, loading, refetch: fetchMilestones };
}
