# Asteroid

This project contains:

- a Next.js mint site for Base payments and automatic token delivery
- a minimal Hardhat project for deploying the `Asteroid` ERC20 token on Base Mainnet

## Token Contract

Contract: `contracts/Asteroid.sol`

- Name: `Asteroid`
- Symbol: `Asteroid`
- Total supply: `100,000,000`
- Decimals: `18`
- Initial supply is minted once to `DEV_WALLET`
- No owner
- No mint function after deployment
- No tax
- No blacklist
- No max wallet
- No upgradeability
- No proxy
- No special transfer restrictions

ERC20 contracts do not carry a token avatar by default. The logo is submitted after deployment through BaseScan, wallet/token-list metadata, or token listing platforms. Use the Asteroid mascot image as the token logo when submitting metadata.

## Website Environment

Use `.env` for the running website.

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
X402_PAY_TO_ADDRESS=0xYourEthReceiver
TOKEN_CONTRACT_ADDRESS=0xYourAsteroidTokenContract
TOKEN_DISTRIBUTOR_PRIVATE_KEY=your_distributor_wallet_private_key
TOKEN_DISTRIBUTOR_WALLET_ADDRESS=0xOptionalDistributorWalletAddress
SQLITE_DATABASE_PATH=.data/mini-asteroid.sqlite
BASE_RPC_URL=https://mainnet.base.org
X402_FACILITATOR_URL=https://facilitator.payai.network
```

Required for paid mint and automatic token delivery:

- `X402_PAY_TO_ADDRESS`: wallet that receives ETH payments
- `TOKEN_CONTRACT_ADDRESS`: deployed Asteroid ERC20 contract address
- `TOKEN_DISTRIBUTOR_PRIVATE_KEY`: private key for the wallet that sends tokens to buyers
- `BASE_RPC_URL`: Base Mainnet RPC
- `SQLITE_DATABASE_PATH`: local SQLite ledger for quota, payments, and delivery state

The distributor wallet must hold enough Asteroid tokens to pay users out. If `DEV_WALLET` receives the full supply and is not the distributor wallet, transfer a distribution budget from `DEV_WALLET` to the distributor wallet before opening live mint.

## Contract Deployment Environment

Use `.envcopy` only for contract deployment. This keeps deployment keys separate from the website `.env`.

```bash
cp .envcopy.example .envcopy
```

Fill in:

```bash
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_deployer_private_key
DEV_WALLET=0xYourDevWalletAddress
ETHERSCAN_API_KEY=your_etherscan_or_basescan_api_key
```

Deployment variables:

- `BASE_RPC_URL`: Base Mainnet RPC
- `PRIVATE_KEY`: deployer wallet private key, with enough ETH for gas
- `DEV_WALLET`: wallet that receives the full `100,000,000` Asteroid supply
- `ETHERSCAN_API_KEY`: explorer verification key

Hardhat loads `.envcopy` first. If `.envcopy` is missing, it falls back to `.env`.

## Deploy To Base Mainnet

```bash
npm install
npm run contracts:build
npm run contracts:deploy:base
```

The deployment script will:

- read `DEV_WALLET`
- fail if `DEV_WALLET` is missing or invalid
- deploy `Asteroid`
- print the deployed contract address
- print token name, symbol, decimals, total supply, and `DEV_WALLET` balance

After deployment, put the printed contract address into the website `.env`:

```bash
TOKEN_CONTRACT_ADDRESS=0xNewAsteroidContractAddress
```

Then rebuild and restart the website:

```bash
npm run build
npm run start
```

## Verify On BaseScan

Use the deployed contract address and the same `DEV_WALLET` constructor argument:

```bash
npx hardhat verify --build-profile production --network base DEPLOYED_CONTRACT_ADDRESS DEV_WALLET
```

Example:

```bash
npx hardhat verify --build-profile production --network base 0xYourContractAddress 0xYourDevWalletAddress
```

## Live Mint Check

The website is ready for paid mint and automatic delivery when this endpoint returns `live` and `true`:

```bash
curl http://127.0.0.1:3000/api/mint/config
```

Expected fields:

```json
{
  "x402Mode": "live",
  "distributionEnabled": true
}
```
