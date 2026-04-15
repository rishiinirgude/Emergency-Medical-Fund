import { Networks, SorobanRpc } from "@stellar/stellar-sdk";

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
  "https://soroban-testnet.stellar.org";

export const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
