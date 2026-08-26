# Guardrail

A spend-policy vault for AI agents. The vault owner deposits an ERC20 token
(mUSDT on testnet) and grants agent addresses narrow, revocable spending
policies — a per-transaction cap, a rolling daily cap, an address allowlist,
and an expiry. Agents call the vault themselves to pay within those limits;
every attempt (approved or denied) is logged onchain for auditing.

Built with Hardhat + TypeScript.

## Contracts

- `contracts/AgentVault.sol` — the policy vault. See `contracts/README.md`
  for the design decision behind its non-revert-on-denial `agentPay`.
- `contracts/MockUSDT.sol` — a minimal 6-decimal mock ERC20 ("Mock USDT",
  `mUSDT`) with a public, unrestricted `mint`. Testnet only.

## Setup

```bash
npm install
npm run compile
npm test
```

## Deploying to HSK Testnet

Not yet run — no funded deployer wallet exists yet. Once one does:

```bash
cp .env.example .env
# edit .env and set AGENT_DEPLOYER_KEY to a funded testnet private key
npm run deploy:hsk
```

This runs `scripts/deploy.ts`, which deploys `MockUSDT` then `AgentVault`
(pointed at the deployed `MockUSDT`), and prints both addresses.

## Requirements

Node 18+ (developed against Node 20; Hardhat 2.x is used rather than
Hardhat 3, which requires Node 22+).
