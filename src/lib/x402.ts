import { NextResponse } from "next/server";
import { isAutomaticDistributionReady } from "@/lib/token-distribution";
import { x402PayToAddress } from "@/lib/runtime-config";

const PAY_TO = x402PayToAddress;

export const x402Mode =
  PAY_TO && isAutomaticDistributionReady() ? "live" : "simulation";

type LiveHandlerOptions = {
  amountWei: string;
  description: string;
  receipt: {
    bundleId: string;
    label: string;
    quotaCost: number;
    priceEth: number;
  };
};

export function createX402MintRoute(options: LiveHandlerOptions) {
  void options;

  return async function disabledX402MintHandler() {
    return NextResponse.json(
      {
        ok: false,
        mode: x402Mode,
        message: "This mint route is disabled. Use the Base ETH payment flow instead.",
      },
      { status: 410 }
    );
  };
}
