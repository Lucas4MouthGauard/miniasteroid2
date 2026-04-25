# AAVE Donation Claim MVP PRD

## Goal

Build a wallet-connected claim site where a user becomes eligible after:

1. Their connected ETH address has sent any non-zero native ETH transfer to `0x0fCa5194baA59a362a835031d9C4A25970effE68`.
2. They complete two X task confirmations: follow the target account and repost the target post.

After both task groups are complete, the user can claim exactly `30000` tokens once. The Claim button becomes disabled after a claim is submitted or confirmed.

## Scope

- Use RainbowKit and wagmi for wallet connection.
- Query real ETH transfer history server-side through Etherscan API v2.
- Keep secrets server-only in `.env`.
- Persist wallet task state and claim status in SQLite.
- Send ERC-20 tokens from the configured distributor private key to the connected wallet.
- Redesign the UI in a minimalist modern style with electric blue accents, structured whitespace, animated but restrained surfaces, and a custom RainbowKit modal theme.

## User Flow

1. User connects wallet.
2. User clicks "Verify Donation".
3. Server checks whether the wallet has sent native ETH to the donation recipient.
4. User opens each X task. The verify button unlocks after a 3 second cooldown.
5. When donation and both X tasks are verified, Claim becomes enabled.
6. User clicks Claim.
7. Server transfers `CLAIM_TOKEN_AMOUNT` ERC-20 tokens from the distributor wallet.
8. Claim state is persisted and the button remains disabled.

## Functional Requirements

- Donation verification must not rely on client-provided transaction hashes.
- Donation amount has no minimum except greater than zero.
- X checks are intentionally manual cooldown confirmations, not real X API verification.
- A wallet can claim only once.
- If token contract or distributor private key is missing, Claim must fail closed with a clear configuration error.
- Private keys must never be exposed to the browser.

## Environment

- `DONATION_RECIPIENT_ADDRESS`
- `DONATION_CHAIN_ID`
- `ETHERSCAN_API_KEY`
- `ETHERSCAN_API_BASE_URL`
- `TOKEN_CONTRACT_ADDRESS`
- `TOKEN_DISTRIBUTOR_PRIVATE_KEY`
- `TOKEN_DISTRIBUTOR_WALLET_ADDRESS`
- `CLAIM_TOKEN_AMOUNT`
- `BASE_RPC_URL`

## Non-Goals

- Real X OAuth or X API validation.
- Asking the user for approvals beyond wallet connection.
- Any transfer from the user's wallet to the app during claim.
