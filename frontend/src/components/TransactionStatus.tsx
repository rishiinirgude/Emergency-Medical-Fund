"use client";

import { CheckCircle, ExternalLink, Loader2, XCircle } from "lucide-react";
import { getExplorerUrl } from "@/lib/utils";

interface Props {
  status: "idle" | "pending" | "success" | "error";
  txHash?: string;
  message?: string;
}

export default function TransactionStatus({ status, txHash, message }: Props) {
  if (status === "idle") return null;

  return (
    <div
      className={`rounded-xl p-4 flex items-start gap-3 text-sm ${
        status === "pending"
          ? "bg-blue-50 border border-blue-200"
          : status === "success"
          ? "bg-green-50 border border-green-200"
          : "bg-red-50 border border-red-200"
      }`}
    >
      {status === "pending" && (
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0 mt-0.5" />
      )}
      {status === "success" && (
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
      )}
      {status === "error" && (
        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
      )}

      <div className="flex-1 min-w-0">
        <p
          className={`font-medium ${
            status === "pending"
              ? "text-blue-700"
              : status === "success"
              ? "text-green-700"
              : "text-red-700"
          }`}
        >
          {status === "pending"
            ? "Transaction pending..."
            : status === "success"
            ? "Transaction confirmed!"
            : "Transaction failed"}
        </p>
        {message && <p className="text-gray-600 mt-0.5 text-xs">{message}</p>}
        {txHash && (
          <a
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-1 text-xs"
          >
            View on Stellar Expert
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
