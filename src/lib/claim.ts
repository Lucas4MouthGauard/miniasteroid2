export const CLAIM_DISTRIBUTOR_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cumulativeAmount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const CLAIM_EIP712_DOMAIN = {
  name: "AsteroidClaimDistributor",
  version: "1",
} as const;

export const CLAIM_EIP712_TYPES = {
  Claim: [
    { name: "account", type: "address" },
    { name: "cumulativeAmount", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
