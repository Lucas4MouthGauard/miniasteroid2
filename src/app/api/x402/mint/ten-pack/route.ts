import { createX402MintRoute } from "@/lib/x402";

export const POST = createX402MintRoute({
  amountWei: "20000000000000000",
  description: "Asteroid ten mint bundle",
  receipt: {
    bundleId: "tenPack",
    label: "B",
    quotaCost: 10,
    priceEth: 0.02,
  },
});
