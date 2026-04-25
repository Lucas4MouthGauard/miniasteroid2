import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { getDistributionStatus } from "@/lib/token-distribution";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { ok: false, message: "A valid address is required." },
      { status: 400 }
    );
  }

  return NextResponse.json(await getDistributionStatus(getAddress(address)));
}
