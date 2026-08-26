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

See `docs/superpowers/plans/deployment-addresses.md` for the current
addresses and deployment details.

## Setup

```bash
npm install
npm run compile
npm test
```

## Deploying to HSK Testnet

```bash
cp .env.example .env
# edit .env and set AGENT_DEPLOYER_KEY to a funded testnet private key
npm run deploy:hsk
```

This runs `scripts/deploy.ts`, which deploys `MockUSDT` then `AgentVault`
(pointed at the deployed `MockUSDT`), and prints both addresses. Get
testnet HSK for gas from https://hsk.xyz/faucet.

## Web app

The dashboard + agent chat UI lives in `web/` (Next.js). It's under active
development — see `docs/superpowers/plans/2026-08-26-guardrail-app-implementation.md`
for the build plan. Once it's runnable end-to-end, setup instructions will
land here.

## Requirements

Node 18+ (developed against Node 20; Hardhat 2.x is used rather than
Hardhat 3, which requires Node 22+).
