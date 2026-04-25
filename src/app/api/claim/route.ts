import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { getClaimConfig, processAirdropClaim } from "@/lib/airdrop-claim";

type ClaimRequest = {
  address?: string;
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    config: getClaimConfig(),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ClaimRequest;

  if (!body.address || !isAddress(body.address)) {
    return NextResponse.json(
      { ok: false, error: "A valid wallet address is required." },
      { status: 400 }
    );
  }

  try {
    const snapshot = await processAirdropClaim(getAddress(body.address));

    return NextResponse.json({
      ok: true,
      ...snapshot,
      config: getClaimConfig(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Claim failed.",
      },
      { status: 400 }
    );
  }
}
