import { network } from "hardhat";
import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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

function normalizePrivateKey(privateKey: string | undefined) {
  if (!privateKey) {
    return null;
  }

  return (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
}

async function main() {
  const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS?.trim();
  const claimSignerPrivateKey = normalizePrivateKey(process.env.CLAIM_SIGNER_PRIVATE_KEY?.trim());

  if (!tokenAddress) {
    throw new Error("TOKEN_CONTRACT_ADDRESS is missing. Add it to your .env file before deploying.");
  }

  if (!isAddress(tokenAddress)) {
    throw new Error(`TOKEN_CONTRACT_ADDRESS is invalid: ${tokenAddress}`);
  }

  if (!claimSignerPrivateKey) {
    throw new Error(
      "CLAIM_SIGNER_PRIVATE_KEY is missing. Add a dedicated signer key to your .env file before deploying."
    );
  }

  const claimSigner = privateKeyToAccount(claimSignerPrivateKey);
  const normalizedTokenAddress = getAddress(tokenAddress);
  const { ethers } = await network.create();
  const networkName = process.env.HARDHAT_NETWORK ?? "selected-network";

  console.log(`Deploying AsteroidClaimDistributor to network: ${networkName}`);
  console.log(`Token address: ${normalizedTokenAddress}`);
  console.log(`Claim signer: ${claimSigner.address}`);

  const distributor = await ethers.deployContract("AsteroidClaimDistributor", [
    normalizedTokenAddress,
    claimSigner.address,
  ]);
  const deploymentTx = distributor.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error("Deployment transaction could not be created.");
  }

  console.log(`Deployment tx hash: ${deploymentTx.hash}`);

  const receipt = await deploymentTx.wait();

  if (!receipt || receipt.status !== 1 || !receipt.contractAddress) {
    throw new Error("Deployment transaction did not produce a successful contract receipt.");
  }

  const distributorAddress = receipt.contractAddress;

  await waitForCode(ethers.provider, distributorAddress);

  console.log("AsteroidClaimDistributor deployed successfully.");
  console.log(`Distributor address: ${distributorAddress}`);
  console.log(`Token address: ${normalizedTokenAddress}`);
  console.log(`Claim signer: ${claimSigner.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
