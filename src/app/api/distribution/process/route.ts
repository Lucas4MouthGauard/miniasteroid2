import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import {
  buildDistributionStatusResponse,
  processTokenDistributions,
} from "@/lib/token-distribution";

type ProcessDistributionRequest = {
  address?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ProcessDistributionRequest;

  if (!body.address || !isAddress(body.address)) {
    return NextResponse.json(
      { ok: false, message: "A valid address is required." },
      { status: 400 }
    );
  }

  const snapshot = await processTokenDistributions(getAddress(body.address));
  return NextResponse.json(buildDistributionStatusResponse(snapshot));
}
