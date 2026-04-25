import { createX402MintRoute } from "@/lib/x402";

export const POST = createX402MintRoute({
  amountWei: "40000000000000000",
  description: "Asteroid max mint bundle",
  receipt: {
    bundleId: "fullPack",
    label: "C",
    quotaCost: 20,
    priceEth: 0.04,
  },
});
