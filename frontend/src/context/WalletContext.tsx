"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  isConnected,
  getAddress,
  signTransaction,
  requestAccess,
} from "@stellar/freighter-api";

interface WalletContextType {
  address: string | null;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connected: false,
  connect: async () => {},
  disconnect: () => {},
  signTx: async () => "",
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);

  // Auto-reconnect if Freighter already has access
  useEffect(() => {
    (async () => {
      try {
        const connected = await isConnected();
        if (connected) {
          const result = await getAddress();
          if (result.address) setAddress(result.address);
        }
      } catch {
        // Freighter not installed — silently ignore
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    try {
      await requestAccess();
      const result = await getAddress();
      if (result.address) setAddress(result.address);
    } catch (err) {
      console.error("Freighter connect error:", err);
      throw new Error("Failed to connect Freighter wallet");
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const signTx = useCallback(async (xdr: string): Promise<string> => {
    const result = await signTransaction(xdr, {
      networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE,
    });
    if (result.error) throw new Error(result.error);
    return result.signedTxXdr;
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, connected: !!address, connect, disconnect, signTx }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
