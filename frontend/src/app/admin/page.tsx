"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Hospital, Loader2, Plus, Trash2, ShieldCheck, AlertCircle } from "lucide-react";
import { nativeToScVal, Address } from "@stellar/stellar-sdk";
import { useWallet } from "@/context/WalletContext";
import { invokeContract, readContract, contracts } from "@/hooks/useContracts";
import { shortenAddress } from "@/lib/utils";
import TransactionStatus from "@/components/TransactionStatus";

type TxStatus = "idle" | "pending" | "success" | "error";

export default function AdminPage() {
  const { address, connected, signTx } = useWallet();

  const [hospitals, setHospitals] = useState<string[]>([]);
  const [admin, setAdmin] = useState<string>("");
  const [newHospital, setNewHospital] = useState("");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string>();
  const [loading, setLoading] = useState(true);

  const isAdmin = !!address && address === admin;

  async function fetchData() {
    setLoading(true);
    try {
      const [list, adminAddr] = await Promise.all([
        readContract(contracts.hospitalVerification, "get_hospitals", []),
        readContract(contracts.hospitalVerification, "admin", []),
      ]);
      setHospitals(list as string[]);
      setAdmin(adminAddr as string);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddHospital(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    if (!newHospital.match(/^G[A-Z2-7]{55}$/)) {
      toast.error("Invalid Stellar address");
      return;
    }
    try {
      setTxStatus("pending");
      await invokeContract(
        contracts.hospitalVerification,
        "add_hospital",
        [new Address(newHospital).toScVal()],
        address,
        signTx
      );
      setTxStatus("success");
      toast.success("Hospital verified!");
      setNewHospital("");
      fetchData();
    } catch (err: unknown) {
      setTxStatus("error");
      toast.error("Failed to add hospital");
      console.error(err);
    }
  }

  async function handleRemoveHospital(hospital: string) {
    if (!address) return;
    try {
      setTxStatus("pending");
      await invokeContract(
        contracts.hospitalVerification,
        "remove_hospital",
        [new Address(hospital).toScVal()],
        address,
        signTx
      );
      setTxStatus("success");
      toast.success("Hospital removed");
      fetchData();
    } catch (err: unknown) {
      setTxStatus("error");
      toast.error("Failed to remove hospital");
      console.error(err);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">Manage verified hospitals on Stellar</p>
        </div>
      </div>

      {connected && !isAdmin && admin && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-700 font-medium">Read-only access</p>
            <p className="text-amber-600 text-xs mt-0.5">
              Only the contract admin ({shortenAddress(admin)}) can modify hospitals.
            </p>
          </div>
        </div>
      )}

      {!connected && (
        <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 text-sm">
          <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-gray-500">Connect your Freighter wallet to interact.</p>
        </div>
      )}

      {isAdmin && (
        <div className="card mb-5">
          <h2 className="font-bold text-gray-900 mb-4">Add Verified Hospital</h2>
          <form onSubmit={handleAddHospital} className="flex gap-2">
            <input
              type="text"
              placeholder="Stellar address (G...)"
              value={newHospital}
              onChange={(e) => setNewHospital(e.target.value)}
              className="input-field flex-1"
            />
            <button
              type="submit"
              disabled={txStatus === "pending"}
              className="btn-primary flex items-center gap-1.5 px-4 flex-shrink-0"
            >
              {txStatus === "pending" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add
            </button>
          </form>
          {txStatus !== "idle" && (
            <div className="mt-3">
              <TransactionStatus status={txStatus} txHash={txHash} />
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Verified Hospitals</h2>
          <span className="text-sm text-gray-400">{hospitals.length} total</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : hospitals.length === 0 ? (
          <div className="text-center py-8">
            <Hospital className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No verified hospitals yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hospitals.map((h) => (
              <div key={h} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="font-mono text-sm text-gray-700">{shortenAddress(h, 8)}</span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleRemoveHospital(h)}
                    disabled={txStatus === "pending"}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
