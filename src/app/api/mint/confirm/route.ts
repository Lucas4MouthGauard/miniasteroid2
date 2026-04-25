import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddressEqual, parseEther } from "viem";
import { base } from "viem/chains";
import { MINT_BUNDLES, type MintBundleId } from "@/lib/content";
import { confirmMintPayment } from "@/lib/server-store";
import {
  buildDistributionStatusResponse,
  processTokenDistributions,
} from "@/lib/token-distribution";
import { baseRpcUrl, x402PayToAddress } from "@/lib/runtime-config";

type ConfirmMintRequest = {
  address?: string;
  bundleId?: MintBundleId;
  txHash?: `0x${string}`;
};

const baseClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl),
});

function isTxHash(value: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ConfirmMintRequest;

  if (!body.address || !body.bundleId || !body.txHash) {
    return NextResponse.json(
      { ok: false, message: "Address, bundleId, and txHash are required." },
      { status: 400 }
    );
  }

  if (!x402PayToAddress) {
    return NextResponse.json(
      { ok: false, message: "Payment receiver is not configured." },
      { status: 503 }
    );
  }

  if (!isTxHash(body.txHash)) {
    return NextResponse.json(
      { ok: false, message: "Transaction hash is invalid." },
      { status: 400 }
    );
  }

  const bundle = MINT_BUNDLES.find((item) => item.id === body.bundleId);
  if (!bundle) {
    return NextResponse.json(
      { ok: false, message: "Mint bundle was not found." },
      { status: 400 }
    );
  }

  try {
    const [transaction, receipt] = await Promise.all([
      baseClient.getTransaction({ hash: body.txHash }),
      baseClient.getTransactionReceipt({ hash: body.txHash }),
    ]);

    const expectedValue = parseEther(String(bundle.priceEth));
    const expectedPayTo = getAddress(x402PayToAddress);
    const expectedFrom = getAddress(body.address);

    if (receipt.status !== "success") {
      throw new Error("This payment transaction did not succeed onchain.");
    }

    if (!transaction.to || !isAddressEqual(transaction.to, expectedPayTo)) {
      throw new Error("The payment receiver does not match the configured address.");
    }

    if (!isAddressEqual(transaction.from, expectedFrom)) {
      throw new Error("The payment sender does not match the connected wallet.");
    }

    if (transaction.value !== expectedValue) {
      throw new Error("The payment amount does not match this mint bundle.");
    }

    const snapshot = confirmMintPayment(
      body.address,
      bundle.id,
      body.txHash,
      expectedValue.toString()
    );
    const distribution = buildDistributionStatusResponse(
      await processTokenDistributions(body.address)
    );

    return NextResponse.json({
      ok: true,
      mode: "native-eth-live",
      txLabel: snapshot.alreadyRecorded ? "Already confirmed" : "Base payment confirmed",
      message: snapshot.alreadyRecorded
        ? "This payment was already linked to your mint."
        : "Mint bundle confirmed.",
      bundle,
      state: snapshot.state,
      globalLedger: snapshot.globalLedger,
      distribution,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Mint payment confirmation failed.",
      },
      { status: 400 }
    );
  }
}
