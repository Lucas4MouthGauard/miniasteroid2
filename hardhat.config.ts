import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";

const envFile = process.env.DOTENV_CONFIG_PATH ?? (existsSync(".envcopy") ? ".envcopy" : ".env");
loadEnv({ path: envFile });

function normalizePrivateKey(privateKey: string | undefined) {
  if (!privateKey) {
    return [];
  }

  return [privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`];
}

const solidityConfig = {
  version: "0.8.24",
  settings: {
    evmVersion: "cancun",
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};

const baseRpcUrl = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const etherscanApiKey =
  process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY || "";

if (!process.env.ETHERSCAN_API_KEY && process.env.BASESCAN_API_KEY) {
  console.warn(
    "[hardhat] BASESCAN_API_KEY detected without ETHERSCAN_API_KEY. Hardhat verify for Base uses the Etherscan V2 API, so an ETHERSCAN_API_KEY is recommended for verification.",
  );
}

export default defineConfig({
  plugins: [hardhatEthers, hardhatVerify],
  solidity: {
    profiles: {
      default: solidityConfig,
      production: solidityConfig,
    },
  },
  networks: {
    base: {
      type: "http",
      chainType: "op",
      url: baseRpcUrl,
      chainId: 8453,
      accounts: normalizePrivateKey(process.env.PRIVATE_KEY),
    },
  },
  verify: {
    etherscan: {
      apiKey: etherscanApiKey,
    },
  },
});
