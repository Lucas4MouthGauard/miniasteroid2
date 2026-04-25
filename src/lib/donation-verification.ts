import { formatEther, getAddress, isAddressEqual } from "viem";
import {
  donationChainId,
  donationRecipientAddress,
  etherscanApiBaseUrl,
  etherscanApiKey,
} from "@/lib/runtime-config";

type EtherscanTx = {
  blockNumber: string;
  timeStamp: string;
  hash: `0x${string}`;
  from: string;
  to: string;
  value: string;
  isError?: string;
  txreceipt_status?: string;
};

type EtherscanResponse = {
  status: string;
  message: string;
  result: EtherscanTx[] | string;
};

export type DonationVerificationResult = {
  verified: boolean;
  txHash: `0x${string}` | null;
  totalWei: string;
  totalEth: string;
  checkedChainId: string;
  recipient: `0x${string}`;
};

function sumBigInt(values: string[]) {
  return values.reduce((sum, value) => sum + BigInt(value), BigInt(0));
}

export async function verifyDonationTransfer(
  addressInput: string
): Promise<DonationVerificationResult> {
  if (!etherscanApiKey) {
    throw new Error("ETHERSCAN_API_KEY is required for real ETH transfer checks.");
  }

  const walletAddress = getAddress(addressInput);
  const recipient = getAddress(donationRecipientAddress);
  const params = new URLSearchParams({
    chainid: donationChainId,
    module: "account",
    action: "txlist",
    address: walletAddress,
    startblock: "0",
    endblock: "99999999",
    page: "1",
    offset: "10000",
    sort: "desc",
    apikey: etherscanApiKey,
  });

  const response = await fetch(`${etherscanApiBaseUrl}?${params.toString()}`, {
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error("Unable to reach the ETH transaction indexer.");
  }

  const payload = (await response.json()) as EtherscanResponse;

  if (!Array.isArray(payload.result)) {
    if (payload.message?.toLowerCase().includes("no transactions")) {
      return {
        verified: false,
        txHash: null,
        totalWei: "0",
        totalEth: "0",
        checkedChainId: donationChainId,
        recipient,
      };
    }

    throw new Error(
      typeof payload.result === "string"
        ? payload.result
        : "The ETH transaction indexer returned an invalid response."
    );
  }

  const matchingTransfers = payload.result.filter((tx) => {
    return (
      tx.value !== "0" &&
      tx.isError !== "1" &&
      tx.txreceipt_status !== "0" &&
      isAddressEqual(getAddress(tx.from), walletAddress) &&
      tx.to &&
      isAddressEqual(getAddress(tx.to), recipient)
    );
  });

  const totalWei = sumBigInt(matchingTransfers.map((tx) => tx.value)).toString();

  return {
    verified: matchingTransfers.length > 0,
    txHash: matchingTransfers[0]?.hash ?? null,
    totalWei,
    totalEth: formatEther(BigInt(totalWei)),
    checkedChainId: donationChainId,
    recipient,
  };
}
