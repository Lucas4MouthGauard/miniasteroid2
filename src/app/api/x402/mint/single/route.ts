import { createX402MintRoute } from "@/lib/x402";

export const POST = createX402MintRoute({
  amountWei: "2000000000000000",
  description: "Asteroid single mint bundle",
  receipt: {
    bundleId: "single",
    label: "A",
    quotaCost: 1,
    priceEth: 0.002,
  },
});
