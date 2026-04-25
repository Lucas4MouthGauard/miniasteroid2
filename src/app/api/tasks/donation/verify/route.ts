import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { verifyDonationTransfer } from "@/lib/donation-verification";
import { recordDonationVerification } from "@/lib/server-store";

type VerifyDonationRequest = {
  address?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as VerifyDonationRequest;

  if (!body.address || !isAddress(body.address)) {
    return NextResponse.json(
      { ok: false, error: "A valid wallet address is required." },
      { status: 400 }
    );
  }

  try {
    const result = await verifyDonationTransfer(getAddress(body.address));
    const snapshot = recordDonationVerification(body.address, result);

    return NextResponse.json({
      ok: true,
      donation: result,
      ...snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Donation verification failed.",
      },
      { status: 400 }
    );
  }
}
