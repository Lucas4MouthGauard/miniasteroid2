import { NextResponse } from "next/server";
import { TOTAL_GLOBAL_MINT_CAP, TOKENS_PER_MINT } from "@/lib/content";
import { isAutomaticDistributionReady } from "@/lib/token-distribution";
import { x402Mode } from "@/lib/x402";
import {
  BASESCAN_BASE_URL,
  tokenContractAddress,
  tokenDistributorWalletAddress,
  x402PayToAddress,
} from "@/lib/runtime-config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    x402Mode,
    cap: TOTAL_GLOBAL_MINT_CAP,
    tokenPerMint: TOKENS_PER_MINT,
    paymentRail: "Base ETH payment",
    contractAddress: tokenContractAddress,
    payToAddress: x402PayToAddress,
    distributionEnabled: isAutomaticDistributionReady(),
    distributorWalletAddress: tokenDistributorWalletAddress,
    explorerBaseUrl: BASESCAN_BASE_URL,
  });
}
