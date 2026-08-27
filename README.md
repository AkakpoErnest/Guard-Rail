# Guardrail

A spend-policy vault for AI agents. The vault owner deposits an ERC20 token
(mUSDT on testnet) and grants agent addresses narrow, revocable spending
policies — a per-transaction cap, a rolling daily cap, an address allowlist,
and an expiry. Agents call the vault themselves to pay within those limits;
every attempt (approved or denied) is logged onchain for auditing.

## Problem

Giving an AI agent the ability to spend money today means giving it a
private key with no built-in ceiling. Once an agent holds a funded wallet,
whatever it decides to spend — a $5 top-up or a $5,000 mistake — goes
through, because nothing between the agent's decision and the chain is
checking. The usual workarounds (a human approves every transaction, or the
agent just isn't trusted with funds at all) either kill autonomy or kill
usefulness.

## Solution

Guardrail puts the spending limits *in the contract the money lives in*,
not in the agent's prompt or in a backend's application logic that the
agent (or a bug, or a prompt injection) could talk its way around. The
owner sets a max-per-transaction cap, a rolling daily cap, an address
allowlist, and an expiry directly on an `AgentVault` contract. The agent
gets its own signing key and can call the vault whenever it wants — but the
vault, not the agent, decides whether the payment actually happens. Every
attempt is logged onchain, approved or denied, so there's a permanent audit
trail of what the agent tried to do. The owner can revoke the agent's
access instantly, at any time, with one transaction.

Built with Hardhat + TypeScript (contracts) and Next.js + wagmi/viem +
Claude (the demo app).

## Contracts

- `contracts/AgentVault.sol` — the policy vault. See `contracts/README.md`
  for the design decision behind its non-revert-on-denial `agentPay`.
- `contracts/MockUSDT.sol` — a minimal 6-decimal mock ERC20 ("Mock USDT",
  `mUSDT`) with a public, unrestricted `mint`. Testnet only.

## Deployed contracts (HSK Testnet, chain ID 133)

| Contract | Address |
| --- | --- |
| `AgentVault` | [`0x2b7A01CCE709c403478B878904F2cec64E02c63b`](https://testnet-explorer.hsk.xyz/address/0x2b7A01CCE709c403478B878904F2cec64E02c63b) |
| `MockUSDT` (`mUSDT`) | `0x7509D67775132c43974D69D61eA75Fd0e1A1D5f2` |

See `docs/superpowers/plans/deployment-addresses.md` for deployment details
(deployer address, deploy date).

## How it works

Guardrail uses two separate wallet identities, deliberately kept apart:

- **The owner's wallet** — your real browser wallet, connected via
  RainbowKit. It's the only thing that can call `setPolicy` (set or replace
  an agent's spending rules) or `revoke` (kill an agent's access instantly).
  The vault is `Ownable`; only this wallet's owner key can touch policy.
- **The agent's wallet** — a separate, dedicated private key held
  server-side by the Next.js API route (`web/app/api/agent/route.ts`),
  never exposed to the browser. It's the only thing that can call
  `agentPay`, and only within whatever policy the owner currently has set
  for it. It never holds the funds itself — it just has permission to move
  the vault's funds inside the policy's limits.

The vault contract is the actual enforcement point, not the agent's
prompt or the backend code. A notable design choice: `agentPay` does
**not** revert when a payment violates policy. Instead it emits a
`PaymentAttempt(agent, to, amount, approved, reason)` event either way —
approved or denied — and only reverts on truly exceptional failures (like
the token transfer itself failing). This is what makes the live receipt
feed in the UI able to show denials as real, permanent, queryable onchain
history instead of losing them to a rolled-back transaction. See
[`TECHNICAL.md`](TECHNICAL.md) for the full rationale and the rest of the
architecture.

## Setup

### 1. Contracts (repo root)

```bash
npm install
npm run compile
npm test
```

`npm test` runs the Hardhat test suite (10 tests covering the happy path,
each policy-denial reason, cap accumulation, UTC-day rollover, revoke,
expiry, owner-only access, and an agent with no policy at all).

### 2. Web app (`web/`)

```bash
cd web
npm install
cp .env.local.example .env.local
# fill in .env.local — see the variable list below
npm run dev
```

Then open http://localhost:3000. `.env.local` needs:

| Variable | Description |
| --- | --- |
| `AGENT_PRIVATE_KEY` | The agent's own signing key (server-side only, testnet-only, low funds — generate with `cast wallet new`) |
| `ANTHROPIC_API_KEY` | Anthropic API key powering the chat agent's Claude tool-use loop |
| `NEXT_PUBLIC_AGENT_VAULT_ADDRESS` | Deployed `AgentVault` address (see table above) |
| `NEXT_PUBLIC_MOCK_USDT_ADDRESS` | Deployed `MockUSDT` address (see table above) |
| `NEXT_PUBLIC_AGENT_ADDRESS` | The agent wallet's public address (derived from `AGENT_PRIVATE_KEY`, but the UI needs it client-side too, e.g. to label it in the chat header) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID for RainbowKit (a free ID from https://cloud.walletconnect.com works fine for a demo) |

## Deploying contracts to HSK Testnet

```bash
cp .env.example .env
# edit .env and set AGENT_DEPLOYER_KEY to a funded testnet private key
npm run deploy:hsk
```

This runs `scripts/deploy.ts`, which deploys `MockUSDT` then `AgentVault`
(pointed at the deployed `MockUSDT`), and prints both addresses. Get
testnet HSK for gas from https://hsk.xyz/faucet.

## Demo

See [`docs/demo-script.md`](docs/demo-script.md) for a word-for-word,
timed 3-minute demo script (fund → two approved payments → a denied
oversized payment live in the receipt feed → revoke mid-conversation →
agent goes dead), including a pre-demo checklist with the vault's actual
current policy state.

## Requirements

Node 18+ (developed against Node 20; Hardhat 2.x is used rather than
Hardhat 3, which requires Node 22+).
