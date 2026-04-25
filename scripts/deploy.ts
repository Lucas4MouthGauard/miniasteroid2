import { network } from "hardhat";
import { getAddress, isAddress } from "viem";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCode(
  provider: Awaited<ReturnType<(typeof network)["create"]>>["ethers"]["provider"],
  contractAddress: string,
  attempts = 30,
  delayMs = 2_000
) {
  for (let index = 0; index < attempts; index += 1) {
    const code = await provider.getCode(contractAddress);

    if (code !== "0x") {
      return;
    }

    await sleep(delayMs);
  }

  throw new Error(
    `Contract code was not available at ${contractAddress} after waiting for deployment propagation.`
  );
}

async function readWithRetry<T>(
  label: string,
  reader: () => Promise<T>,
  attempts = 8,
  delayMs = 1_500
) {
  let lastError: unknown;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await reader();
    } catch (error) {
      lastError = error;
      await sleep(delayMs);
    }
  }

  throw new Error(
    `Failed while reading ${label} after deployment.${lastError instanceof Error ? ` ${lastError.message}` : ""}`
  );
}

async function main() {
  const devWallet = process.env.DEV_WALLET?.trim();

  if (!devWallet) {
    throw new Error("DEV_WALLET is missing. Add it to your .envcopy file before deploying.");
  }

  if (!isAddress(devWallet)) {
    throw new Error(`DEV_WALLET is invalid: ${devWallet}`);
  }

  const normalizedDevWallet = getAddress(devWallet);
  const { ethers } = await network.create();
  const networkName = process.env.HARDHAT_NETWORK ?? "selected-network";

  console.log(`Deploying Asteroid to network: ${networkName}`);
  console.log(`DEV wallet: ${normalizedDevWallet}`);

  const token = await ethers.deployContract("Asteroid", [normalizedDevWallet]);
  const deploymentTx = token.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error("Deployment transaction could not be created.");
  }

  console.log(`Deployment tx hash: ${deploymentTx.hash}`);

  const receipt = await deploymentTx.wait();

  if (!receipt || receipt.status !== 1 || !receipt.contractAddress) {
    throw new Error("Deployment transaction did not produce a successful contract receipt.");
  }

  const tokenAddress = receipt.contractAddress;

  await waitForCode(ethers.provider, tokenAddress);

  const deployedToken = await ethers.getContractAt("Asteroid", tokenAddress);
  const [name, symbol, decimals, totalSupply, devWalletBalance] = await Promise.all([
    readWithRetry("token name", () => deployedToken.name()),
    readWithRetry("token symbol", () => deployedToken.symbol()),
    readWithRetry("token decimals", () => deployedToken.decimals()),
    readWithRetry("total supply", () => deployedToken.totalSupply()),
    readWithRetry("DEV wallet balance", () => deployedToken.balanceOf(normalizedDevWallet)),
  ]);

  console.log("Asteroid deployed successfully.");
  console.log(`Contract address: ${tokenAddress}`);
  console.log(`Token name: ${name}`);
  console.log(`Token symbol: ${symbol}`);
  console.log(`Token decimals: ${decimals}`);
  console.log(`Total supply: ${ethers.formatUnits(totalSupply, decimals)}`);
  console.log(`DEV wallet balance: ${ethers.formatUnits(devWalletBalance, decimals)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
