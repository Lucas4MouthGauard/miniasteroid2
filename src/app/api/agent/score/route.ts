import { NextRequest, NextResponse } from "next/server";
import { scoreBlessingMessage } from "@/lib/scoring";
import { reviewBlessing } from "@/lib/server-store";

type ScoreRequest = {
  message?: string;
  address?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ScoreRequest;
  const message = body.message?.trim() ?? "";

  await new Promise((resolve) => setTimeout(resolve, 2800));

  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Blessing content is required." },
      { status: 400 }
    );
  }

  if (!body.address) {
    const result = scoreBlessingMessage(message);

    return NextResponse.json({
      ok: true,
      ...result,
      protocol: "Base · EIP-8004 Agent",
      simulated: true,
    });
  }

  const result = reviewBlessing(body.address, message);

  return NextResponse.json({
    ok: true,
    ...result.blessing,
    state: result.state,
    globalLedger: result.globalLedger,
    protocol: "Base · EIP-8004 Agent",
    simulated: true,
  });
}
