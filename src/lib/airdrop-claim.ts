import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isHash,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  baseRpcUrl,
  claimTokenAmount,
  tokenContractAddress,
  tokenDistributorPrivateKey,
  tokenDistributorWalletAddress,
} from "@/lib/runtime-config";
import {
  markAirdropClaimConfirmed,
  markAirdropClaimFailed,
  markAirdropClaimSubmitted,
  startAirdropClaim,
} from "@/lib/server-store";

const CLAIM_TOKEN_DECIMALS = 18;

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

const account = tokenDistributorPrivateKey
  ? privateKeyToAccount(tokenDistributorPrivateKey)
  : null;

const publicClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
});

const walletClient = account
  ? createWalletClient({
      account,
      chain: base,
      transport: http(baseRpcUrl),
    })
  : null;

export function isClaimDistributorReady() {
  return Boolean(tokenContractAddress && account && walletClient);
}

export function getClaimConfig() {
  return {
    enabled: isClaimDistributorReady(),
    tokenContractAddress,
    distributorWalletAddress: account?.address ?? tokenDistributorWalletAddress,
    amount: claimTokenAmount,
    chainId: base.id,
    chainName: base.name,
  };
}

export async function processAirdropClaim(addressInput: string) {
  const address = getAddress(addressInput);
  startAirdropClaim(address);

  if (!tokenContractAddress || !account || !walletClient) {
    const message =
      "TOKEN_CONTRACT_ADDRESS and TOKEN_DISTRIBUTOR_PRIVATE_KEY are required before claims can be submitted.";
    markAirdropClaimFailed(address, message);
    throw new Error(message);
  }

  try {
    const txHash = await walletClient.writeContract({
      account,
      chain: base,
      address: tokenContractAddress,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [address, parseUnits(String(claimTokenAmount), CLAIM_TOKEN_DECIMALS)],
    });

    const hash = isHash(txHash) ? (txHash as `0x${string}`) : txHash;
    markAirdropClaimSubmitted(address, hash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status !== "success") {
      throw new Error("The claim token transfer reverted on Base.");
    }

    return markAirdropClaimConfirmed(address, hash);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Claim token transfer failed.";
    markAirdropClaimFailed(address, message);
    throw new Error(message);
  }
}
