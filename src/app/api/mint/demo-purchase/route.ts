import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { MINT_BUNDLES, type MintBundleId } from "@/lib/content";
import { recordMint } from "@/lib/server-store";
import {
  buildDistributionStatusResponse,
  isAutomaticDistributionReady,
  processTokenDistributions,
} from "@/lib/token-distribution";
import { x402PayToAddress } from "@/lib/runtime-config";

type DemoPurchaseRequest = {
  address?: string;
  bundleId?: MintBundleId;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as DemoPurchaseRequest;
  const bundle = MINT_BUNDLES.find((item) => item.id === body.bundleId);

  if (x402PayToAddress && isAutomaticDistributionReady()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Demo mint is disabled while live Base ETH payments are enabled.",
      },
      { status: 403 }
    );
  }

  if (!body.address || !bundle) {
    return NextResponse.json(
      { ok: false, message: "Address and bundleId are required." },
      { status: 400 }
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 2200));

  try {
    const snapshot = recordMint(body.address, bundle.id, randomUUID(), "simulated");
    const distribution = buildDistributionStatusResponse(
      await processTokenDistributions(body.address)
    );

    return NextResponse.json({
      ok: true,
      mode: "simulation",
      bundle,
      txLabel: "Payment confirmed",
      message: "Mint bundle confirmed.",
      state: snapshot.state,
      globalLedger: snapshot.globalLedger,
      distribution,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Mint could not be recorded.",
      },
      { status: 400 }
    );
  }
}
