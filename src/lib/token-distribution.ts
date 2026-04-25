import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isHash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  getPendingTokenDistributions,
  getSubmittedTokenDistributions,
  getTokenDistributionSnapshot,
  markTokenDistributionConfirmed,
  markTokenDistributionFailed,
  markTokenDistributionSubmitted,
  markTokenDistributionSubmitting,
  type TokenDistributionSnapshot,
} from "@/lib/server-store";
import {
  baseRpcUrl,
  tokenContractAddress,
  tokenDistributorPrivateKey,
  tokenDistributorWalletAddress,
} from "@/lib/runtime-config";

const baseClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
});
const DISTRIBUTOR_ACCOUNT = tokenDistributorPrivateKey
  ? privateKeyToAccount(tokenDistributorPrivateKey)
  : null;
const distributorWalletClient = DISTRIBUTOR_ACCOUNT
  ? createWalletClient({
      account: DISTRIBUTOR_ACCOUNT,
      chain: base,
      transport: http(baseRpcUrl),
    })
  : null;
const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type DistributionStatusResponse = {
  ok: true;
  enabled: boolean;
  status: TokenDistributionSnapshot["latestStatus"] | "idle";
  purchasedUnits: number;
  deliveredUnits: number;
  pendingUnits: number;
  failedUnits: number;
  cumulativeAmount: string;
  deliveredAmount: string;
  pendingAmount: string;
  tokenContractAddress: `0x${string}` | null;
  distributorWalletAddress: `0x${string}` | null;
  latestTxHash: `0x${string}` | null;
  latestError: string | null;
  message: string;
};

export function isAutomaticDistributionReady() {
  return Boolean(tokenContractAddress && tokenDistributorPrivateKey);
}

function getDistributionMessage(
  snapshot: TokenDistributionSnapshot,
  enabled: boolean
) {
  if (snapshot.failedUnits > 0) {
    return "Automatic delivery failed. You can retry the token payout from the server.";
  }

  if (snapshot.pendingUnits > 0) {
    if (!enabled) {
      return "Automatic delivery is not configured yet. Live mint stays paused so the site cannot take ETH without paying tokens out.";
    }

    if (snapshot.latestStatus === "submitted") {
      return "Token payout has been sent on Base and should arrive after confirmation.";
    }

    if (snapshot.latestStatus === "submitting") {
      return "The server is sending the token payout transaction.";
    }

    return "Token payout is queued for automatic delivery.";
  }

  if (snapshot.deliveredUnits > 0) {
    return "Tokens have been delivered automatically to your wallet.";
  }

  if (!enabled) {
    return "Automatic delivery is not configured yet.";
  }

  return "No token delivery is pending right now.";
}

export function buildDistributionStatusResponse(
  snapshot: TokenDistributionSnapshot
): DistributionStatusResponse {
  const enabled = isAutomaticDistributionReady();

  return {
    ok: true,
    enabled,
    status: snapshot.latestStatus,
    purchasedUnits: snapshot.purchasedUnits,
    deliveredUnits: snapshot.deliveredUnits,
    pendingUnits: snapshot.pendingUnits,
    failedUnits: snapshot.failedUnits,
    cumulativeAmount: snapshot.cumulativeAmount,
    deliveredAmount: snapshot.deliveredAmount,
    pendingAmount: snapshot.pendingAmount,
    tokenContractAddress,
    distributorWalletAddress:
      snapshot.distributorWalletAddress ?? tokenDistributorWalletAddress,
    latestTxHash: snapshot.latestTxHash,
    latestError: snapshot.latestError,
    message: getDistributionMessage(snapshot, enabled),
  };
}

async function submitDistributionRequest(sourceId: string, address: string, amountWei: string) {
  if (!tokenContractAddress || !DISTRIBUTOR_ACCOUNT || !distributorWalletClient) {
    throw new Error("Automatic token delivery wallet is not configured.");
  }

  const txHash = await distributorWalletClient.writeContract({
    account: DISTRIBUTOR_ACCOUNT,
    chain: base,
    address: tokenContractAddress,
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [getAddress(address), BigInt(amountWei)],
  });

  return {
    status: "submitted" as const,
    txHash: isHash(txHash) ? (txHash as `0x${string}`) : null,
    providerReference: sourceId,
    distributorWalletAddress: DISTRIBUTOR_ACCOUNT.address,
  };
}

export async function syncSubmittedTokenDistributions(address: string) {
  const submitted = getSubmittedTokenDistributions(address);

  for (const distribution of submitted) {
    if (!distribution.txHash) {
      continue;
    }

    try {
      const receipt = await baseClient.getTransactionReceipt({
        hash: distribution.txHash,
      });

      if (receipt.status === "success") {
        markTokenDistributionConfirmed(distribution.sourceId, distribution.txHash);
      } else {
        markTokenDistributionFailed(
          distribution.sourceId,
          "The payout transaction reverted on Base.",
          distribution.txHash
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("not found")) {
        continue;
      }

      markTokenDistributionFailed(
        distribution.sourceId,
        error instanceof Error
          ? error.message
          : "Unable to verify the payout transaction on Base.",
        distribution.txHash
      );
    }
  }
}

export async function processTokenDistributions(addressInput: string) {
  const address = getAddress(addressInput);

  await syncSubmittedTokenDistributions(address);

  if (!isAutomaticDistributionReady()) {
    return getTokenDistributionSnapshot(address);
  }

  const queued = getPendingTokenDistributions(address);

  for (const distribution of queued) {
    markTokenDistributionSubmitting(distribution.sourceId);

    try {
      const result = await submitDistributionRequest(
        distribution.sourceId,
        address,
        distribution.amountWei
      );

      markTokenDistributionSubmitted(
        distribution.sourceId,
        result.txHash,
        result.providerReference,
        result.distributorWalletAddress
      );
    } catch (error) {
      markTokenDistributionFailed(
        distribution.sourceId,
        error instanceof Error ? error.message : "Automatic delivery failed.",
        distribution.txHash ?? null
      );
    }
  }

  await syncSubmittedTokenDistributions(address);

  return getTokenDistributionSnapshot(address);
}

export async function getDistributionStatus(addressInput: string) {
  const address = getAddress(addressInput);
  await syncSubmittedTokenDistributions(address);
  return buildDistributionStatusResponse(getTokenDistributionSnapshot(address));
}
