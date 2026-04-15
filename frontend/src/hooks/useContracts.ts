import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { rpc, NETWORK_PASSPHRASE } from "@/config/stellar";
import contractAddresses from "@/config/contracts.json";

const MAX_FEE = "1000000"; // 0.1 XLM max fee

// ── Helper: build + simulate + send ──────────────────────────────────────────

export async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  signerAddress: string,
  signTx: (xdr: string) => Promise<string>
): Promise<unknown> {
  const account = await rpc.getAccount(signerAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: MAX_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Simulate to get footprint
  const simResult = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  const signedXdr = await signTx(preparedTx.toXDR());

  const sendResult = await rpc.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  );

  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction failed: ${sendResult.errorResult}`);
  }

  // Poll for confirmation
  let getResult = await rpc.getTransaction(sendResult.hash);
  while (getResult.status === SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
    await new Promise((r) => setTimeout(r, 1000));
    getResult = await rpc.getTransaction(sendResult.hash);
  }

  if (getResult.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
    throw new Error("Transaction failed on-chain");
  }

  return getResult.returnValue ? scValToNative(getResult.returnValue) : null;
}

// ── Helper: read-only simulation ─────────────────────────────────────────────

export async function readContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<unknown> {
  // Use a dummy account for read-only calls
  const dummyAccount = {
    accountId: () => "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    sequenceNumber: () => "0",
    incrementSequenceNumber: () => {},
  } as Parameters<typeof TransactionBuilder>[0];

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(dummyAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simResult)) {
    throw new Error(`Read failed: ${simResult.error}`);
  }

  const successResult = simResult as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  return successResult.result ? scValToNative(successResult.result.retval) : null;
}

// Re-export for convenience
import { SorobanRpc } from "@stellar/stellar-sdk";

export const contracts = {
  medicalFund: contractAddresses.MedicalFund,
  hospitalVerification: contractAddresses.HospitalVerification,
  careToken: contractAddresses.CareToken,
};

export { nativeToScVal, Address };
