import { privateKeyToAccount } from "viem/accounts";

export const BASESCAN_BASE_URL = "https://basescan.org";

export const baseRpcUrl = process.env.BASE_RPC_URL ?? "https://mainnet.base.org";

export const tokenContractAddress =
  (process.env.TOKEN_CONTRACT_ADDRESS as `0x${string}` | undefined) ?? null;

export const x402PayToAddress =
  (process.env.X402_PAY_TO_ADDRESS as `0x${string}` | undefined) ?? null;

function normalizePrivateKey(value: string | undefined) {
  if (!value) {
    return null;
  }

  return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
}

// Inject these from your hosting platform's secret manager at runtime.
// Do not commit them, expose them to the client, or send them in chat.
export const tokenDistributorPrivateKey = normalizePrivateKey(
  process.env.TOKEN_DISTRIBUTOR_PRIVATE_KEY?.trim()
);
export const tokenDistributorWalletAddress =
  (process.env.TOKEN_DISTRIBUTOR_WALLET_ADDRESS as `0x${string}` | undefined) ??
  (tokenDistributorPrivateKey ? privateKeyToAccount(tokenDistributorPrivateKey).address : null);

export const sqliteDatabasePath =
  process.env.SQLITE_DATABASE_PATH ?? ".data/mini-asteroid.sqlite";
