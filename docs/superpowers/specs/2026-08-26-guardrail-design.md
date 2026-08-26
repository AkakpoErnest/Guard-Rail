# Guardrail — Spend-Policy Wallet for AI Agents

**Date:** 2026-08-26
**Status:** Approved for implementation
**Author:** Ernest K. (with Claude)

## Summary

Guardrail lets a user hand an AI agent spending power without handing over unlimited funds. The user deploys a vault contract, funds it with a stablecoin, and grants an agent a key bound to onchain rules: max per transaction, daily cap, an allowlist of recipients, and an expiry. The agent pays autonomously through a chat interface backed by Claude; the contract enforces the policy regardless of what the agent tries to do, and the owner can revoke access instantly.

This is a hackathon submission for the HSK Chain track (AI Agents / Payment category). The demo narrative leads with a **denial**: the agent successfully makes a couple of small payments, then confidently attempts an oversized one and gets rejected by the contract, visible live in a receipt feed. Then the owner revokes access mid-conversation.

## Non-goals

- No production-grade security audit (this is a hackathon demo on testnet).
- No multi-agent support — one agent per vault for this version.
- No persistent database — allowlist labels ("Airtime vendor") are a small in-memory/config mapping in the frontend, not onchain metadata.
- No real stablecoin — HashKey Chain testnet has no confirmed USDT deployment (verified via HSK docs + Blockscout testnet explorer, 2026-08-26), so we deploy our own mock ERC20 (`mUSDT`).

## Architecture

```
┌─────────────────────────────┐
│   Next.js app (guardrail)    │
│                               │
│  Owner's browser              │
│   - wagmi/viem + RainbowKit   │
│   - calls setPolicy/revoke    │──────┐
│   - reads getPolicy,          │      │
│     dailySpentToday           │      │
│                               │      │
│  Chat UI  ──▶ /api/agent      │      │
│               (Claude tool    │      │
│               loop, 1 tool:   │      │
│               pay())          │      │
│                    │           │      │
│                    ▼           ▼      ▼
│           Agent hot wallet    AgentVault.sol  (HSK testnet)
│           (AGENT_PRIVATE_KEY,  ├─ setPolicy / revoke (owner)
│            env, testnet-only)  ├─ agentPay (agent)
│                    │           └─ emits PaymentAttempt
│                    └──────────────────▶ (approved/denied)
│                               │
│  Receipt feed ◀── watches PaymentAttempt events
└─────────────────────────────┘
             │
             ▼
      MockUSDT.sol (mUSDT, 6 decimals, public mint())
```

Two separate signing identities:
- **Owner** — the user's real connected wallet in the browser. Signs `setPolicy` and `revoke`.
- **Agent** — a dedicated hot wallet held server-side (`AGENT_PRIVATE_KEY`, testnet-only, low/no funds needed beyond gas). Signs `agentPay` calls triggered by Claude's tool use.

## Components

### 1. Contracts (Hardhat + TypeScript, `~/Documents/guardrail`)

**`AgentVault.sol`** (~120 lines)
- `setPolicy(address agent, uint256 maxPerTx, uint256 dailyCap, address[] calldata allowlist, uint256 expiry)` — owner-only. Stores a `Policy` struct per agent (maxPerTx, dailyCap, allowlist as a mapping for O(1) lookup, expiry as unix timestamp, `active` bool, `dailySpent`, `lastSpendDay`).
- `agentPay(address to, uint256 amount, string calldata reason)` — callable only by an address holding an active policy.
  - **Design decision:** does **not** revert on policy violations. It runs the checks, and if any fail, emits `PaymentAttempt(agent, to, amount, approved=false, reason)` and returns without transferring funds. It only reverts on true exceptional failures (e.g. the ERC20 transfer itself failing). This is deliberate: a revert rolls back its own event log, which would make onchain denials invisible to event-watchers — and "emit an event on every attempt, approved and denied" is the core demo requirement. This overrides looser "reverts on violation" language from the original brief.
  - On success: transfers `amount` of `mUSDT` from the vault to `to`, updates `dailySpent` (rolling over on UTC day change), emits `PaymentAttempt(..., approved=true, reason)`.
- `revoke(address agent)` — owner-only, sets the policy inactive immediately.
- `getPolicy(address agent)` / `dailySpentToday(address agent)` — views for the UI.
- Event: `PaymentAttempt(address indexed agent, address indexed to, uint256 amount, bool approved, string reason)`.

**`MockUSDT.sol`** — OpenZeppelin ERC20, "Mock USDT" / `mUSDT`, 6 decimals, public `mint(address, uint256)`. NatSpec-labeled as testnet-only.

Tests (`test/AgentVault.test.ts`) cover: in-policy payment succeeds; over-maxPerTx denied; over-dailyCap denied; non-allowlisted recipient denied; post-revoke denied; post-expiry denied; daily cap accumulates correctly across multiple payments; daily counter resets on UTC day rollover.

Deploy script (`scripts/deploy.ts`) deploys `MockUSDT` then `AgentVault`, prints both addresses. `hardhat.config.ts` adds an `hskTestnet` network: chain ID 133, RPC `https://testnet.hsk.xyz`, accounts from `AGENT_DEPLOYER_KEY` env var.

*(This component's implementation was dispatched to a background subagent once this part of the design was confirmed — contracts + tests only, no live deploy yet since no funded key exists.)*

### 2. Agent + backend (`app/api/agent/route.ts`)

- Single Claude tool: `pay(recipient: string, amount: number, reason: string)`.
- Flow: chat message in → Claude decides whether/how to call `pay` → route resolves `recipient` (a label like "Airtime vendor") against a small known allowlist-label mapping → signs and submits `agentPay()` via viem using `AGENT_PRIVATE_KEY` → waits for the tx receipt → reads back the `PaymentAttempt` event for the *real* approved/denied + reason (since the contract never reverts on policy denial, "the tx didn't revert" is not sufficient — the event is the source of truth) → returns that outcome to Claude, which relays it in natural language.
- No cross-session conversation memory — matches the existing mockup's "Reset demo" behavior.

### 3. UI (`app/`, React/Next.js, rebuilt from the existing mockup)

- Existing static mockup (`~/Downloads/Gaurd rail /index (1).html`) is the visual reference — same dark theme, same layout (sidebar, policy panel, chat + chain-state panel, receipt feed table). Rebuilt as real components instead of one static file.
- Policy sliders (max/tx, daily cap), allowlist editor, expiry → write through the owner's connected wallet (wagmi/viem + RainbowKit) to `setPolicy`.
- Stat tiles, usage bar → read from `getPolicy` / `dailySpentToday`.
- Receipt feed → subscribes to/polls `PaymentAttempt` events, newest first, shows approved/denied + reason + block number, exactly like the mockup's table.
- Chat panel → posts to `/api/agent` instead of the mockup's local `process()` function.
- Revoke button/toggle → calls `revoke()` onchain.

### 4. Docs & demo

- `README.md` — what it is, architecture summary, local run instructions, deployed contract addresses (filled in after deploy).
- `TECHNICAL.md` — policy-enforcement design (incl. the non-revert-on-denial rationale), contract interface, why HSK testnet + mock token, agent wallet model, known limitations.
- A word-for-word 3-minute demo script: fund vault → two successful 5 USDT payments → attempted 500 USDT payment denied (shown live in receipt feed) → revoke mid-conversation → agent goes dead. Rehearsed twice before presenting, per the original brief.

## Error handling

- Contract: policy violations are non-reverting, always logged (see above). Only truly unexpected failures (token transfer failure, reentrancy guard trip) revert.
- Backend: if the agent wallet has insufficient gas, or the RPC call fails outright (not a policy denial, a transport failure), the chat surfaces a distinct "couldn't reach the chain" message rather than misreporting it as a policy denial.
- UI: if wallet isn't connected, policy-editing controls are disabled with a prompt to connect; if the vault has zero mUSDT balance, the UI should surface that distinctly from "denied by policy" (insufficient vault funds vs. policy violation are different failure modes worth distinguishing for judges).

## Testing

- Contract: Hardhat unit tests (listed above) must pass before deploy.
- Backend: manual verification against testnet once deployed (no separate test suite planned given the time budget — this is a demo, not a production service).
- UI: manual walkthrough of the demo script twice before presenting.

## Open items carried into implementation planning

- Exact allowlist label-to-address mapping mechanism (simple constant in frontend config vs. a small onchain label registry) — default to frontend config for time's sake unless the plan surfaces a reason not to.
- Whether Blockscout contract verification is worth the time during the build — treated as nice-to-have, not blocking.
