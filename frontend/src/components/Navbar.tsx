"use client";

import Link from "next/link";
import { Heart, Menu, X, Wallet, LogOut } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { shortenAddress } from "@/lib/utils";
import toast from "react-hot-toast";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { address, connected, connect, disconnect } = useWallet();

  async function handleConnect() {
    try {
      await connect();
      toast.success("Freighter wallet connected");
    } catch {
      toast.error("Install Freighter wallet to continue");
    }
  }

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-red-600">
            <Heart className="w-6 h-6 fill-red-500 text-red-500" />
            <span className="hidden sm:block">MedFund</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-gray-600 hover:text-red-600 transition-colors text-sm font-medium">
              Campaigns
            </Link>
            <Link href="/create" className="text-gray-600 hover:text-red-600 transition-colors text-sm font-medium">
              Start Campaign
            </Link>
            <Link href="/admin" className="text-gray-600 hover:text-red-600 transition-colors text-sm font-medium">
              Admin
            </Link>
          </div>

          {/* Wallet */}
          <div className="flex items-center gap-3">
            {connected && address ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:block text-sm font-mono text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                  {shortenAddress(address, 6)}
                </span>
                <button
                  onClick={disconnect}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Disconnect"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:block">Connect Freighter</span>
                <span className="sm:hidden">Connect</span>
              </button>
            )}

            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-gray-100 flex flex-col gap-3">
            <Link href="/" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-red-600 font-medium px-2 py-1">
              Campaigns
            </Link>
            <Link href="/create" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-red-600 font-medium px-2 py-1">
              Start Campaign
            </Link>
            <Link href="/admin" onClick={() => setMenuOpen(false)} className="text-gray-700 hover:text-red-600 font-medium px-2 py-1">
              Admin
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
