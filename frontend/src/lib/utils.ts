import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function stroopsToXlm(stroops: bigint): string {
  return (Number(stroops) / 10_000_000).toFixed(7).replace(/\.?0+$/, "");
}

export function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function getExplorerUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}
