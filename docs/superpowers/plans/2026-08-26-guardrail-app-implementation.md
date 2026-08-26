# Guardrail App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the already-built `AgentVault`/`MockUSDT` contracts to HSK testnet, then build the Next.js app (owner dashboard + Claude-driven agent chat + live receipt feed) that turns the approved design spec into the working three-minute demo.

**Architecture:** A new `web/` Next.js 14 (App Router, TypeScript, Tailwind) app inside the existing `~/Documents/guardrail` repo, sitting alongside the existing `contracts/` Hardhat project. The owner's browser wallet (wagmi/RainbowKit) signs `setPolicy`/`revoke` directly. A Next.js API route (`app/api/agent/route.ts`) runs a one-tool Claude tool-use loop and, when Claude calls `pay(...)`, signs and submits `agentPay()` using a server-held agent wallet (viem), then reads back the real `PaymentAttempt` event to report the true approved/denied outcome (the contract never reverts on policy denial — see `contracts/AgentVault.sol` NatSpec). The UI ports the existing static mockup's markup/CSS into React components and wires every faked bit of state to real contract reads/writes/events.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS, wagmi v2 + viem v2 + RainbowKit v2 + @tanstack/react-query v5 (same pattern as the FlowLink app), @anthropic-ai/sdk, vitest for pure-logic unit tests.

**Reference spec:** `docs/superpowers/specs/2026-08-26-guardrail-design.md`
**Reference mockup:** `~/Downloads/Gaurd rail /index (1).html` (visual/behavioral reference for every component below)
**Existing contracts (already built, do not modify unless a task below says to):** `contracts/AgentVault.sol`, `contracts/MockUSDT.sol`

---

## Task 1: Deploy contracts to HSK testnet

**Files:**
- Modify: `.env` (gitignored, local only)
- Create: `docs/superpowers/plans/deployment-addresses.md` (records the deployed addresses so later tasks can read them without re-deploying)

- [ ] **Step 1: Generate a deployer wallet**

```bash
cast wallet new
```

Save the printed address and private key. This is a testnet-only throwaway key — do not reuse it for anything holding real funds.

- [ ] **Step 2: Fund the deployer wallet**

Send the printed address to the user (or, if running non-interactively, STOP here and ask the user) to fund via the official faucet:

> https://hsk.xyz/faucet — sends 1 HSK per address per 24h, enough for multiple contract deployments and dozens of `agentPay` calls on testnet gas costs.

Do not proceed to Step 3 until the address has a nonzero HSK balance. Verify with:

```bash
cast balance <DEPLOYER_ADDRESS> --rpc-url https://testnet.hsk.xyz
```

Expected: a nonzero wei value.

- [ ] **Step 3: Set the deployer key and run the deploy script**

```bash
cd ~/Documents/guardrail
echo "AGENT_DEPLOYER_KEY=<the private key from Step 1>" >> .env
npm run deploy:hsk
```

Expected output: two lines like:
```
MockUSDT deployed to: 0x...
AgentVault deployed to: 0x...
```

- [ ] **Step 4: Record the deployed addresses**

Create `docs/superpowers/plans/deployment-addresses.md`:

```markdown
# Guardrail — HSK Testnet Deployment

- Network: HashKey Chain Testnet (chain ID 133)
- MockUSDT: <address from Step 3>
- AgentVault: <address from Step 3>
- Deployed: <today's date>
- Deployer: <deployer address from Step 1>
- Explorer: https://testnet-explorer.hsk.xyz/address/<AgentVault address>
```

- [ ] **Step 5: Sanity-check the deployment on Blockscout**

Open `https://testnet-explorer.hsk.xyz/address/<AgentVault address>` and confirm the contract creation transaction is visible. (Verifying the source on Blockscout is nice-to-have, not required for this task.)

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/deployment-addresses.md
git commit -m "Record HSK testnet deployment addresses"
```

Do NOT commit `.env` — confirm it's gitignored:

```bash
git status --short | grep -q '\.env$' && echo "WARNING: .env is tracked" || echo "OK: .env not tracked"
```

Expected: `OK: .env not tracked`

---

## Task 2: Scaffold the Next.js app

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.mjs`, `web/tailwind.config.ts`, `web/postcss.config.mjs`, `web/app/layout.tsx`, `web/app/globals.css`, `web/.env.local.example`, `web/.gitignore`
- Modify: none outside `web/`

- [ ] **Step 1: Create the app**

```bash
cd ~/Documents/guardrail
npx create-next-app@14 web --typescript --tailwind --app --eslint --src-dir=false --import-alias "@/*" --use-npm
```

When prompted, accept defaults.

- [ ] **Step 2: Install the remaining dependencies**

```bash
cd ~/Documents/guardrail/web
npm install wagmi@^2 viem@^2 @rainbow-me/rainbowkit@^2 @tanstack/react-query@^5 @anthropic-ai/sdk
npm install -D vitest
```

- [ ] **Step 3: Add env template**

Create `web/.env.local.example`:

```bash
# Server-side: the agent's own signing key. Testnet-only, low funds.
# Generate with: cast wallet new
AGENT_PRIVATE_KEY=

# Server-side: Anthropic API key for the chat agent's Claude tool-use loop.
ANTHROPIC_API_KEY=

# Public: deployed contract addresses (see docs/superpowers/plans/deployment-addresses.md)
NEXT_PUBLIC_AGENT_VAULT_ADDRESS=
NEXT_PUBLIC_MOCK_USDT_ADDRESS=

# Public: the agent wallet's address (derived from AGENT_PRIVATE_KEY, but the
# UI needs it client-side too, e.g. to label it in the chat header)
NEXT_PUBLIC_AGENT_ADDRESS=

# Public: WalletConnect project ID for RainbowKit (a free ID from
# https://cloud.walletconnect.com works fine for a demo)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo-project-id
```

- [ ] **Step 4: Fill in `web/.env.local`**

```bash
cp web/.env.local.example web/.env.local
```

Fill in `NEXT_PUBLIC_AGENT_VAULT_ADDRESS` and `NEXT_PUBLIC_MOCK_USDT_ADDRESS` from `docs/superpowers/plans/deployment-addresses.md` (Task 1). Generate a fresh agent signing key (`cast wallet new`, separate from the deployer key) and fill in `AGENT_PRIVATE_KEY` and `NEXT_PUBLIC_AGENT_ADDRESS` from it. Leave `ANTHROPIC_API_KEY` for the user to fill in if not already set as a shell env var.

- [ ] **Step 5: Verify it boots**

```bash
cd ~/Documents/guardrail/web
npm run dev
```

Expected: dev server starts on `http://localhost:3000` with the default Next.js starter page, no errors in the terminal. Stop it with Ctrl+C once confirmed.

- [ ] **Step 6: Commit**

```bash
cd ~/Documents/guardrail
git add web/package.json web/package-lock.json web/tsconfig.json web/next.config.mjs web/tailwind.config.ts web/postcss.config.mjs web/app web/public web/.gitignore web/.eslintrc.json web/.env.local.example
git commit -m "Scaffold Next.js app in web/"
```

(`web/.env.local` must NOT be committed — `create-next-app` already gitignores `.env*.local` by default; confirm with `git status --short` showing no `.env.local` entry.)

---

## Task 3: Contract ABI and address constants

**Files:**
- Create: `web/lib/abi.ts`, `web/lib/contracts.ts`, `web/lib/chain.ts`

- [ ] **Step 1: Write the chain config**

Create `web/lib/chain.ts`:

```typescript
import { hashkeyTestnet } from "viem/chains";

// HashKey Chain Testnet — chain ID 133, RPC https://testnet.hsk.xyz.
// viem ships this chain definition built in; re-exported here so the rest
// of the app has one place to import it from.
export const guardrailChain = hashkeyTestnet;
```

- [ ] **Step 2: Write the ABI constants**

Create `web/lib/abi.ts`:

```typescript
// ABIs hand-derived from contracts/AgentVault.sol and contracts/MockUSDT.sol.
// Keep in sync with those source files if either changes.

export const agentVaultAbi = [
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "maxPerTx", type: "uint256" },
      { name: "dailyCap", type: "uint256" },
      { name: "allowlist", type: "address[]" },
      { name: "expiry", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "agentPay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "maxPerTx", type: "uint256" },
      { name: "dailyCap", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "dailySpent", type: "uint256" },
      { name: "lastSpendDay", type: "uint256" },
      { name: "allowlist", type: "address[]" },
    ],
  },
  {
    type: "function",
    name: "dailySpentToday",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isAllowlisted",
    stateMutability: "view",
    inputs: [
      { name: "agent", type: "address" },
      { name: "to", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "PolicySet",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "maxPerTx", type: "uint256", indexed: false },
      { name: "dailyCap", type: "uint256", indexed: false },
      { name: "allowlist", type: "address[]", indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyRevoked",
    inputs: [{ name: "agent", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "PaymentAttempt",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "approved", type: "bool", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
] as const;

export const mockUsdtAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
```

- [ ] **Step 3: Write the address constants**

Create `web/lib/contracts.ts`:

```typescript
import type { Address } from "viem";

function requireEnv(name: string, value: string | undefined): Address {
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value as Address;
}

export const AGENT_VAULT_ADDRESS = requireEnv(
  "NEXT_PUBLIC_AGENT_VAULT_ADDRESS",
  process.env.NEXT_PUBLIC_AGENT_VAULT_ADDRESS
);

export const MOCK_USDT_ADDRESS = requireEnv(
  "NEXT_PUBLIC_MOCK_USDT_ADDRESS",
  process.env.NEXT_PUBLIC_MOCK_USDT_ADDRESS
);

export const AGENT_ADDRESS = requireEnv(
  "NEXT_PUBLIC_AGENT_ADDRESS",
  process.env.NEXT_PUBLIC_AGENT_ADDRESS
);
```

- [ ] **Step 4: Verify it compiles**

```bash
cd ~/Documents/guardrail/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/guardrail
git add web/lib/abi.ts web/lib/contracts.ts web/lib/chain.ts
git commit -m "Add contract ABI and address constants"
```

---

## Task 4: Allowlist label mapping

**Files:**
- Create: `web/lib/allowlist.ts`
- Test: `web/lib/allowlist.test.ts`

This is the one piece of business logic simple and pure enough to TDD in isolation: resolving a human label ("Airtime vendor") to an onchain address and back, used by both the agent route (Task 6) and the UI (Task 9).

- [ ] **Step 1: Write the failing test**

Create `web/lib/allowlist.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveRecipient, ALLOWLIST_ENTRIES } from "./allowlist";

describe("resolveRecipient", () => {
  it("resolves a known label case-insensitively", () => {
    const entry = resolveRecipient("airtime vendor");
    expect(entry?.label).toBe("Airtime vendor");
    expect(entry?.address).toBe(ALLOWLIST_ENTRIES[0].address);
  });

  it("resolves a raw address that matches an entry", () => {
    const address = ALLOWLIST_ENTRIES[1].address;
    const entry = resolveRecipient(address);
    expect(entry?.label).toBe(ALLOWLIST_ENTRIES[1].label);
  });

  it("resolves an unrecognized address by returning it verbatim with no label", () => {
    const unknown = "0x000000000000000000000000000000000000dE";
    const entry = resolveRecipient(unknown);
    expect(entry?.address).toBe(unknown);
    expect(entry?.label).toBeUndefined();
  });

  it("returns null for text that isn't a label or an address", () => {
    expect(resolveRecipient("send it to the vibes")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd ~/Documents/guardrail/web
npx vitest run lib/allowlist.test.ts
```

Expected: FAIL — `Cannot find module './allowlist'`.

- [ ] **Step 3: Implement**

Create `web/lib/allowlist.ts`:

```typescript
import { isAddress, type Address } from "viem";

export interface AllowlistEntry {
  label: string;
  address: Address;
}

// Demo allowlist. In this scope, recipient labels are frontend config, not
// onchain metadata — see docs/superpowers/specs/2026-08-26-guardrail-design.md,
// "Open items". The addresses themselves ARE the onchain allowlist (set via
// setPolicy in Task 9); this file just maps friendly names to them for the
// chat agent and the UI.
export const ALLOWLIST_ENTRIES: AllowlistEntry[] = [
  {
    label: "Airtime vendor",
    address: "0x8a91C3B9a0D4F5E6C7A8B9D0E1F2A3B4C5D6E7F0",
  },
  {
    label: "Data bundle API",
    address: "0x2d70A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F1",
  },
];

export interface ResolvedRecipient {
  address: string;
  label?: string;
}

/**
 * Resolves free-text (as it might appear in a chat message or a UI form) to
 * a recipient. Tries, in order: exact label match (case-insensitive), known
 * allowlist address match, then falls back to treating the input as a raw
 * address if it's syntactically valid. Returns null if none apply.
 */
export function resolveRecipient(input: string): ResolvedRecipient | null {
  const trimmed = input.trim();

  const byLabel = ALLOWLIST_ENTRIES.find(
    (entry) => entry.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (byLabel) return { address: byLabel.address, label: byLabel.label };

  const byAddress = ALLOWLIST_ENTRIES.find(
    (entry) => entry.address.toLowerCase() === trimmed.toLowerCase()
  );
  if (byAddress) return { address: byAddress.address, label: byAddress.label };

  if (isAddress(trimmed)) return { address: trimmed };

  return null;
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx vitest run lib/allowlist.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/guardrail
git add web/lib/allowlist.ts web/lib/allowlist.test.ts web/vitest.config.ts 2>/dev/null; git add web/lib/allowlist.ts web/lib/allowlist.test.ts
git commit -m "Add allowlist label resolution with tests"
```

If `npx vitest` complains about missing config, create `web/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
```

and add `"test": "vitest run"` to `web/package.json`'s `scripts`, then re-run Step 4 and this commit step.

**IMPORTANT:** Before wiring this into the UI in Task 9, replace the two placeholder addresses above with the real addresses you plan to `setPolicy` with (or generate two fresh demo addresses via `cast wallet new` and use those consistently everywhere — the chat, the policy panel, and the allowlist must all agree on the same addresses for the demo to work end-to-end).

---

## Task 5: Agent wallet — server-side signer and payment execution

**Files:**
- Create: `web/lib/agentWallet.ts`
- Test: `web/lib/agentWallet.test.ts`

- [ ] **Step 1: Write the failing test**

This tests the pure event-decoding logic (`parsePaymentAttempt`) without needing a live chain, by feeding it a hand-built log object shaped like what `agentPay` actually emits.

Create `web/lib/agentWallet.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encodeEventTopics, encodeAbiParameters, type Log } from "viem";
import { agentVaultAbi } from "./abi";
import { parsePaymentAttempt } from "./agentWallet";

function buildPaymentAttemptLog(overrides: {
  agent: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  approved: boolean;
  reason: string;
}): Log {
  const topics = encodeEventTopics({
    abi: agentVaultAbi,
    eventName: "PaymentAttempt",
    args: { agent: overrides.agent, to: overrides.to },
  });
  const data = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "bool" },
      { type: "string" },
    ],
    [overrides.amount, overrides.approved, overrides.reason]
  );
  return {
    address: "0x0000000000000000000000000000000000dEaD",
    topics,
    data,
    blockNumber: 1n,
    blockHash: "0x" + "1".repeat(64),
    transactionHash: "0x" + "2".repeat(64),
    transactionIndex: 0,
    logIndex: 0,
    removed: false,
  } as Log;
}

describe("parsePaymentAttempt", () => {
  it("decodes an approved payment log", () => {
    const log = buildPaymentAttemptLog({
      agent: "0x1000000000000000000000000000000000000A",
      to: "0x2000000000000000000000000000000000000B",
      amount: 5000000n,
      approved: true,
      reason: "",
    });
    const result = parsePaymentAttempt([log]);
    expect(result).not.toBeNull();
    expect(result?.approved).toBe(true);
    expect(result?.amount).toBe(5000000n);
  });

  it("decodes a denied payment log with its reason", () => {
    const log = buildPaymentAttemptLog({
      agent: "0x1000000000000000000000000000000000000A",
      to: "0x2000000000000000000000000000000000000B",
      amount: 500000000n,
      approved: false,
      reason: "amount exceeds dailyCap",
    });
    const result = parsePaymentAttempt([log]);
    expect(result?.approved).toBe(false);
    expect(result?.reason).toBe("amount exceeds dailyCap");
  });

  it("returns null when no PaymentAttempt log is present", () => {
    expect(parsePaymentAttempt([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd ~/Documents/guardrail/web
npx vitest run lib/agentWallet.test.ts
```

Expected: FAIL — `parsePaymentAttempt` is not exported / module has no such function.

- [ ] **Step 3: Implement**

Create `web/lib/agentWallet.ts`:

```typescript
import "server-only";
import {
  createWalletClient,
  createPublicClient,
  http,
  decodeEventLog,
  type Log,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { guardrailChain } from "./chain";
import { agentVaultAbi } from "./abi";
import { AGENT_VAULT_ADDRESS } from "./contracts";

function getAgentAccount() {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) throw new Error("Missing AGENT_PRIVATE_KEY env var");
  return privateKeyToAccount(key as `0x${string}`);
}

const publicClient = createPublicClient({
  chain: guardrailChain,
  transport: http(),
});

function getWalletClient() {
  return createWalletClient({
    account: getAgentAccount(),
    chain: guardrailChain,
    transport: http(),
  });
}

export interface PaymentOutcome {
  approved: boolean;
  amount: bigint;
  reason: string;
  txHash: Hash;
}

/**
 * Scans a transaction's logs for AgentVault's PaymentAttempt event and
 * decodes it. AgentVault.agentPay never reverts on a policy denial (see
 * contracts/AgentVault.sol NatSpec), so this event — not tx success — is the
 * source of truth for whether a payment was actually approved.
 */
export function parsePaymentAttempt(
  logs: readonly Log[]
): { approved: boolean; amount: bigint; reason: string } | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: agentVaultAbi,
        eventName: "PaymentAttempt",
        topics: log.topics,
        data: log.data,
      });
      return {
        approved: decoded.args.approved,
        amount: decoded.args.amount,
        reason: decoded.args.reason,
      };
    } catch {
      // Not a PaymentAttempt log (or from a different event) — skip it.
      continue;
    }
  }
  return null;
}

/**
 * Signs and submits agentPay(to, amount, reason) using the server-held agent
 * wallet, waits for the receipt, and returns the real approved/denied
 * outcome decoded from the PaymentAttempt event.
 */
export async function payViaAgent(
  to: `0x${string}`,
  amount: bigint,
  reason: string
): Promise<PaymentOutcome> {
  const walletClient = getWalletClient();
  const txHash = await walletClient.writeContract({
    address: AGENT_VAULT_ADDRESS,
    abi: agentVaultAbi,
    functionName: "agentPay",
    args: [to, amount, reason],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const outcome = parsePaymentAttempt(receipt.logs);

  if (!outcome) {
    throw new Error(
      `agentPay transaction ${txHash} mined but emitted no PaymentAttempt event`
    );
  }

  return { ...outcome, txHash };
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx vitest run lib/agentWallet.test.ts
```

Expected: PASS, 3 tests. (`payViaAgent` itself is exercised end-to-end manually in Task 6/12 against the live testnet deployment, not unit-tested — it's a thin composition of viem calls already covered by `parsePaymentAttempt`'s tests and viem's own test suite.)

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/guardrail
git add web/lib/agentWallet.ts web/lib/agentWallet.test.ts
git commit -m "Add agent wallet signer and PaymentAttempt event parsing"
```

---

## Task 6: Agent chat API route (Claude tool-use loop)

**Files:**
- Create: `web/app/api/agent/route.ts`

- [ ] **Step 1: Implement the route**

Create `web/app/api/agent/route.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { parseUnits, formatUnits } from "viem";
import { payViaAgent } from "@/lib/agentWallet";
import { resolveRecipient } from "@/lib/allowlist";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const payTool: Anthropic.Tool = {
  name: "pay",
  description:
    "Pay an approved recipient from the vault. The recipient must be a known " +
    "allowlisted vendor label (e.g. 'Airtime vendor') or an address. The vault " +
    "contract enforces per-transaction and daily spending limits itself — call " +
    "this even if you suspect the amount might be too large; report back " +
    "whatever the vault actually decides.",
  input_schema: {
    type: "object",
    properties: {
      recipient: { type: "string", description: "Vendor label or address" },
      amount: { type: "number", description: "Amount in mUSDT (e.g. 5 for 5 USDT)" },
      reason: { type: "string", description: "Short reason for the payment" },
    },
    required: ["recipient", "amount", "reason"],
  },
};

const SYSTEM_PROMPT =
  "You are the payment agent for a Guardrail vault. You can call the `pay` " +
  "tool to move mUSDT to allowlisted recipients. The vault contract, not you, " +
  "enforces spending limits — always attempt the payment the user asks for " +
  "and report the vault's real decision (approved or denied, with its reason) " +
  "rather than pre-judging whether it will work. Keep replies to 1-2 short " +
  "sentences, suitable for a chat bubble.";

export async function POST(req: NextRequest) {
  const { message } = (await req.json()) as { message: string };
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "Missing 'message' string" }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: message }];

  let response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [payTool],
    messages,
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) {
    const text = response.content.find((b) => b.type === "text");
    return NextResponse.json({
      reply: text && text.type === "text" ? text.text : "(no response)",
      payment: null,
    });
  }

  const input = toolUse.input as { recipient: string; amount: number; reason: string };
  const recipient = resolveRecipient(input.recipient);

  let toolResultContent: string;
  let paymentResult: {
    approved: boolean;
    amount: string;
    reason: string;
    recipient: string;
    txHash?: string;
  } | null = null;

  if (!recipient) {
    toolResultContent = `Unknown recipient "${input.recipient}" — not on the allowlist and not a valid address. The vault would reject this.`;
    paymentResult = { approved: false, amount: String(input.amount), reason: "unknown recipient", recipient: input.recipient };
  } else {
    try {
      const amountUnits = parseUnits(String(input.amount), 6); // mUSDT: 6 decimals
      const outcome = await payViaAgent(
        recipient.address as `0x${string}`,
        amountUnits,
        input.reason
      );
      toolResultContent = outcome.approved
        ? `Approved. ${formatUnits(outcome.amount, 6)} mUSDT sent to ${recipient.label ?? recipient.address}.`
        : `Denied by AgentVault: ${outcome.reason}.`;
      paymentResult = {
        approved: outcome.approved,
        amount: formatUnits(outcome.amount, 6),
        reason: outcome.reason,
        recipient: recipient.label ?? recipient.address,
        txHash: outcome.txHash,
      };
    } catch (err) {
      toolResultContent = `Couldn't reach the chain to attempt this payment: ${(err as Error).message}`;
      paymentResult = { approved: false, amount: String(input.amount), reason: "chain error", recipient: recipient.label ?? recipient.address };
    }
  }

  messages.push({ role: "assistant", content: response.content });
  messages.push({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: toolResultContent,
      },
    ],
  });

  response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    tools: [payTool],
    messages,
  });

  const finalText = response.content.find((b) => b.type === "text");

  return NextResponse.json({
    reply: finalText && finalText.type === "text" ? finalText.text : toolResultContent,
    payment: paymentResult,
  });
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/Documents/guardrail/web
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test against the live testnet deployment**

Requires Task 1 (deployed contracts), Task 4 (allowlist addresses matching what you'll `setPolicy` with in Task 9), `AGENT_PRIVATE_KEY` and `ANTHROPIC_API_KEY` set in `web/.env.local`, and the agent address already granted an active policy on the deployed vault (you can call `setPolicy` manually via `cast send` for this smoke test if Task 9's UI isn't built yet — see the design spec's contract interface).

```bash
npm run dev
# in another terminal:
curl -s -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message":"pay 5 USDT to the airtime vendor for a top-up"}' | python3 -m json.tool
```

Expected: JSON with a `reply` string and a `payment` object showing `approved: true` (assuming policy limits allow it) and a real `txHash`.

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/guardrail
git add web/app/api/agent/route.ts
git commit -m "Add Claude tool-use agent chat API route"
```

---

## Task 7: Owner wallet provider

**Files:**
- Create: `web/components/WalletProvider.tsx`
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Implement the provider**

Create `web/components/WalletProvider.tsx` (pattern follows `FlowLink-main/components/providers/wallet-provider.tsx`, scoped down to just the HSK testnet chain this app needs):

```typescript
"use client";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { guardrailChain } from "@/lib/chain";

import "@rainbow-me/rainbowkit/styles.css";

const config = getDefaultConfig({
  appName: "Guardrail",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [guardrailChain],
  transports: {
    [guardrailChain.id]: http("https://testnet.hsk.xyz"),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={guardrailChain}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [ ] **Step 2: Wire it into the root layout**

Read `web/app/layout.tsx` first, then wrap the existing `{children}` with `<WalletProvider>`:

```typescript
import { WalletProvider } from "@/components/WalletProvider";
// ...existing imports...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={/* keep the existing className */}>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify it boots**

```bash
cd ~/Documents/guardrail/web
npm run dev
```

Expected: no errors; visiting `http://localhost:3000` still loads (RainbowKit's connect button isn't placed anywhere yet — that comes in Task 8/9 — this step just confirms the provider doesn't crash the app).

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/guardrail
git add web/components/WalletProvider.tsx web/app/layout.tsx
git commit -m "Add wagmi/RainbowKit wallet provider for HSK testnet"
```

---

## Task 8: Dashboard shell and global styles

**Files:**
- Modify: `web/app/globals.css`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Port the mockup's CSS**

Open `~/Downloads/Gaurd rail /index (1).html` and copy the entire contents of its `<style>` block (lines 8–197, everything between `:root {` and the final closing `}` before `</style>`) into `web/app/globals.css`, appended after Tailwind's `@tailwind` directives that `create-next-app` already put there. Do not modify the copied CSS — it's already a complete, responsive dark theme; components in later tasks will use its existing class names (`.app`, `.sidebar`, `.panel`, `.stat`, `.chat`, `.receipt-table`, etc.) directly rather than Tailwind utility classes, so the visual result matches the approved mockup exactly.

- [ ] **Step 2: Build the static shell**

Replace `web/app/page.tsx` with the mockup's `<body>` markup (lines 200–305 of the mockup) converted to JSX (self-close void elements, `class` → `className`, inline `style` attributes become objects), but leave the dynamic bits as literal placeholder content for now — later tasks (9–12) will replace each section with a real component:

```typescript
export default function DashboardPage() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div className="brand-name">
            guard<span>rail</span>
          </div>
        </div>
        <nav className="nav">
          <button className="active">
            <span className="icon">⌂</span>
            <span>Overview</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="network-card">
            <div className="network-top">
              <span className="network-label">Network</span>
              <i className="live-dot" />
            </div>
            <div className="network-value">HSK Chain</div>
            <div className="network-sub">Testnet</div>
          </div>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <div className="eyebrow">Spend policy wallet</div>
            <h1>Agent control center</h1>
            <div className="subtitle">Give your agent room to act. Keep the final say onchain.</div>
          </div>
        </header>
        {/* PolicyPanel, StatTiles, ChatPanel, ReceiptFeed slot in here in Tasks 9-12 */}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify it renders**

```bash
cd ~/Documents/guardrail/web
npm run dev
```

Visit `http://localhost:3000` — expected: the dark sidebar/topbar shell renders matching the mockup's visual style (fonts, colors, spacing), even though most content is still placeholder.

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/guardrail
git add web/app/globals.css web/app/page.tsx
git commit -m "Port mockup styles and build dashboard shell"
```

---

## Task 9: Policy panel (owner writes: setPolicy, revoke)

**Files:**
- Create: `web/components/PolicyPanel.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Implement the component**

Create `web/components/PolicyPanel.tsx`, reusing the mockup's `.policy-body`/`.control`/`.allowlist`/`.expiry` markup and classes (lines 240–265 of the mockup) but wired to real writes:

```typescript
"use client";

import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { agentVaultAbi } from "@/lib/abi";
import { AGENT_VAULT_ADDRESS, AGENT_ADDRESS } from "@/lib/contracts";
import { ALLOWLIST_ENTRIES } from "@/lib/allowlist";

const SEVEN_DAYS = 7 * 24 * 60 * 60;

export function PolicyPanel() {
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [txCap, setTxCap] = useState(10);
  const [dailyCap, setDailyCap] = useState(20);
  const [active, setActive] = useState(true);

  async function applyPolicy(nextActive: boolean) {
    if (!nextActive) {
      await writeContractAsync({
        address: AGENT_VAULT_ADDRESS,
        abi: agentVaultAbi,
        functionName: "revoke",
        args: [AGENT_ADDRESS],
      });
      setActive(false);
      return;
    }
    const expiry = BigInt(Math.floor(Date.now() / 1000) + SEVEN_DAYS);
    await writeContractAsync({
      address: AGENT_VAULT_ADDRESS,
      abi: agentVaultAbi,
      functionName: "setPolicy",
      args: [
        AGENT_ADDRESS,
        parseUnits(String(txCap), 6),
        parseUnits(String(dailyCap), 6),
        ALLOWLIST_ENTRIES.map((e) => e.address),
        expiry,
      ],
    });
    setActive(true);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Active policy</span>
        <span className="panel-note">{isPending ? "Confirming onchain…" : "Synced"}</span>
      </div>
      <div className="policy-body">
        <div className="policy-agent">
          <div className="agent-info">
            <div className="agent-avatar">✦</div>
            <div>
              <strong>TopUp Agent</strong>
              <small>{AGENT_ADDRESS.slice(0, 6)}...{AGENT_ADDRESS.slice(-4)}</small>
            </div>
          </div>
          <button
            className={`toggle ${active ? "" : "off"}`}
            disabled={!isConnected || isPending}
            onClick={() => applyPolicy(!active)}
          >
            <i />
          </button>
        </div>
        <div className="control">
          <div className="control-row">
            <label>Max per transaction</label>
            <span className="control-value">${txCap} USDT</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={txCap}
            onChange={(e) => setTxCap(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>1 USDT</span>
            <span>100 USDT</span>
          </div>
        </div>
        <div className="control">
          <div className="control-row">
            <label>Daily spending cap</label>
            <span className="control-value">${dailyCap} USDT</span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            value={dailyCap}
            onChange={(e) => setDailyCap(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>5 USDT</span>
            <span>200 USDT</span>
          </div>
        </div>
        <div className="allowlist">
          <div className="allowlist-title">
            Allowed recipients <span style={{ color: "var(--dim)" }}>· {ALLOWLIST_ENTRIES.length} addresses</span>
          </div>
          {ALLOWLIST_ENTRIES.map((entry) => (
            <div className="recipient" key={entry.address}>
              <div className="recipient-left">
                <div className="recipient-mark">₦</div>
                <div>
                  <strong>{entry.label}</strong>
                  <small>{entry.address.slice(0, 6)}...{entry.address.slice(-4)}</small>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          disabled={!isConnected || isPending}
          onClick={() => applyPolicy(true)}
          style={{ marginTop: 16, width: "100%" }}
          className="add-recipient"
        >
          {isPending ? "Confirming…" : "Apply policy onchain"}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Slot it into the page and add the connect button**

In `web/app/page.tsx`, import `ConnectButton` from `@rainbow-me/rainbowkit` and `PolicyPanel` from `@/components/PolicyPanel`. Add `<ConnectButton />` inside `<header className="topbar">`, and replace the `{/* PolicyPanel, ... */}` comment with `<div className="dashboard"><PolicyPanel /></div>` (the other panels fill in the rest of `.dashboard` in Tasks 10–12).

- [ ] **Step 3: Manual verification**

```bash
cd ~/Documents/guardrail/web
npm run dev
```

Connect a testnet wallet holding HSK (via RainbowKit's connect button), move the sliders, click "Apply policy onchain," approve the transaction. Expected: transaction confirms, and querying `getPolicy(AGENT_ADDRESS)` on the deployed contract (e.g. via `cast call`) reflects the new values.

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/guardrail
git add web/components/PolicyPanel.tsx web/app/page.tsx
git commit -m "Wire policy panel to real setPolicy/revoke calls"
```

---

## Task 10: Stat tiles and vault status (reads)

**Files:**
- Create: `web/components/StatTiles.tsx`, `web/components/ChainState.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Implement `StatTiles`**

Create `web/components/StatTiles.tsx`, using the mockup's `.overview`/`.stat` markup (lines 233–237):

```typescript
"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { agentVaultAbi, mockUsdtAbi } from "@/lib/abi";
import { AGENT_VAULT_ADDRESS, MOCK_USDT_ADDRESS, AGENT_ADDRESS } from "@/lib/contracts";

export function StatTiles() {
  const { data: policy } = useReadContract({
    address: AGENT_VAULT_ADDRESS,
    abi: agentVaultAbi,
    functionName: "getPolicy",
    args: [AGENT_ADDRESS],
    query: { refetchInterval: 4000 },
  });
  const { data: vaultBalance } = useReadContract({
    address: MOCK_USDT_ADDRESS,
    abi: mockUsdtAbi,
    functionName: "balanceOf",
    args: [AGENT_VAULT_ADDRESS],
    query: { refetchInterval: 4000 },
  });

  const dailyCap = policy ? Number(formatUnits(policy[1], 6)) : 0;
  const dailySpent = policy ? Number(formatUnits(policy[4], 6)) : 0;
  const remaining = Math.max(0, dailyCap - dailySpent);
  const balance = vaultBalance ? Number(formatUnits(vaultBalance, 6)) : 0;

  return (
    <section className="overview">
      <div className="stat">
        <div className="stat-label">Available balance</div>
        <div className="stat-value">
          <span>$</span>
          <span>{balance.toFixed(2)}</span> <span>USDT</span>
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Spent today</div>
        <div className="stat-value">
          <span>$</span>
          <span>{dailySpent.toFixed(2)}</span> <span>/ {dailyCap} USDT</span>
        </div>
        <div className="stat-foot">
          <em>{remaining.toFixed(2)} USDT</em> remaining in daily cap
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Policy status</div>
        <div className="stat-value">
          <span>{policy?.[3] ? "ACTIVE" : "REVOKED"}</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement `ChainState`**

Create `web/components/ChainState.tsx`, using the mockup's `.chain-state`/`.usage`/`.chain-events` markup (lines 279–289):

```typescript
"use client";

import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { agentVaultAbi } from "@/lib/abi";
import { AGENT_VAULT_ADDRESS, AGENT_ADDRESS } from "@/lib/contracts";

export function ChainState() {
  const { data: policy } = useReadContract({
    address: AGENT_VAULT_ADDRESS,
    abi: agentVaultAbi,
    functionName: "getPolicy",
    args: [AGENT_ADDRESS],
    query: { refetchInterval: 4000 },
  });

  const dailyCap = policy ? Number(formatUnits(policy[1], 6)) : 0;
  const dailySpent = policy ? Number(formatUnits(policy[4], 6)) : 0;
  const pct = dailyCap > 0 ? Math.min(100, (dailySpent / dailyCap) * 100) : 0;
  const active = policy?.[3] ?? false;

  return (
    <aside className="chain-state">
      <div className="chain-state-head">
        <div className="panel-title">Vault status</div>
        <span className={`state-badge ${active ? "" : "revoked"}`}>
          {active ? "● ACTIVE" : "● REVOKED"}
        </span>
      </div>
      <div className="vault-address">CONTRACT ADDRESS</div>
      <div className="address">
        <span>
          {AGENT_VAULT_ADDRESS.slice(0, 6)}...{AGENT_VAULT_ADDRESS.slice(-4)}
        </span>
      </div>
      <div className="usage">
        <div className="usage-head">
          <span>Daily usage</span>
          <strong>
            {dailySpent.toFixed(0)} / {dailyCap} USDT
          </strong>
        </div>
        <div className="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Slot both into the page**

In `web/app/page.tsx`, add `<StatTiles />` above the `.dashboard` div, and pass `<ChainState />` as a sibling of `<PolicyPanel />` inside a `.right-stack`/`.workspace` wrapper matching the mockup's layout (lines 267–290) — the `.chat` panel slot next to it stays empty until Task 12.

- [ ] **Step 4: Manual verification**

```bash
cd ~/Documents/guardrail/web
npm run dev
```

Expected: stat tiles and vault status show real numbers matching whatever policy Task 9 applied on-chain, and update within ~4s of any on-chain change (e.g. re-running Task 9's policy update with different slider values).

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/guardrail
git add web/components/StatTiles.tsx web/components/ChainState.tsx web/app/page.tsx
git commit -m "Wire stat tiles and vault status to live contract reads"
```

---

## Task 11: Live receipt feed (PaymentAttempt events)

**Files:**
- Create: `web/components/ReceiptFeed.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Implement the component**

Create `web/components/ReceiptFeed.tsx`, using the mockup's `.receipts`/`.receipt-table` markup (lines 291–301):

```typescript
"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import { AGENT_VAULT_ADDRESS } from "@/lib/contracts";
import { ALLOWLIST_ENTRIES } from "@/lib/allowlist";

interface Receipt {
  approved: boolean;
  to: string;
  amount: string;
  reason: string;
  blockNumber: bigint;
  txHash: string;
}

const paymentAttemptEvent = parseAbiItem(
  "event PaymentAttempt(address indexed agent, address indexed to, uint256 amount, bool approved, string reason)"
);

function labelFor(address: string) {
  const entry = ALLOWLIST_ENTRIES.find((e) => e.address.toLowerCase() === address.toLowerCase());
  return entry?.label ?? `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ReceiptFeed() {
  const publicClient = usePublicClient();
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    if (!publicClient) return;

    let cancelled = false;

    async function loadInitial() {
      const latest = await publicClient!.getBlockNumber();
      const fromBlock = latest > 5000n ? latest - 5000n : 0n;
      const logs = await publicClient!.getLogs({
        address: AGENT_VAULT_ADDRESS,
        event: paymentAttemptEvent,
        fromBlock,
        toBlock: latest,
      });
      if (cancelled) return;
      setReceipts(
        logs
          .reverse()
          .map((log) => ({
            approved: log.args.approved!,
            to: log.args.to!,
            amount: formatUnits(log.args.amount!, 6),
            reason: log.args.reason!,
            blockNumber: log.blockNumber!,
            txHash: log.transactionHash!,
          }))
      );
    }
    loadInitial();

    const unwatch = publicClient.watchContractEvent({
      address: AGENT_VAULT_ADDRESS,
      abi: [paymentAttemptEvent],
      eventName: "PaymentAttempt",
      onLogs: (logs) => {
        setReceipts((prev) => [
          ...logs.map((log) => ({
            approved: log.args.approved!,
            to: log.args.to!,
            amount: formatUnits(log.args.amount!, 6),
            reason: log.args.reason!,
            blockNumber: log.blockNumber!,
            txHash: log.transactionHash!,
          })).reverse(),
          ...prev,
        ]);
      },
    });

    return () => {
      cancelled = true;
      unwatch();
    };
  }, [publicClient]);

  return (
    <section className="panel receipts">
      <div className="receipts-head">
        <div>
          <span className="panel-title">Live receipt feed</span>
          <span className="panel-note" style={{ marginLeft: 9 }}>
            AgentVault events
          </span>
        </div>
        <div className="receipt-live">
          <i /> LIVE
        </div>
      </div>
      <table className="receipt-table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Recipient</th>
            <th>Amount</th>
            <th>Reason</th>
            <th>Block</th>
          </tr>
        </thead>
        <tbody>
          {receipts.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                No payment attempts yet.
              </td>
            </tr>
          )}
          {receipts.map((r) => (
            <tr key={r.txHash}>
              <td>
                <span className={`result ${r.approved ? "approved" : "denied"}`}>
                  {r.approved ? "✓ Approved" : "× Denied"}
                </span>
              </td>
              <td>{labelFor(r.to)}</td>
              <td>{r.amount} USDT</td>
              <td>{r.reason || "Within policy"}</td>
              <td className="hash">#{r.blockNumber.toString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 2: Slot it into the page**

In `web/app/page.tsx`, add `<ReceiptFeed />` as a sibling below the `.workspace` panel inside `.right-stack`, matching the mockup's layout (line 291 sits directly under the `.workspace` section, both inside `.right-stack`).

- [ ] **Step 3: Manual verification**

```bash
cd ~/Documents/guardrail/web
npm run dev
```

Trigger a payment via Task 6's `curl` smoke test again while this page is open. Expected: a new row appears in the receipt feed within a few seconds, without a page refresh.

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/guardrail
git add web/components/ReceiptFeed.tsx web/app/page.tsx
git commit -m "Add live receipt feed watching PaymentAttempt events"
```

---

## Task 12: Chat panel

**Files:**
- Create: `web/components/ChatPanel.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Implement the component**

Create `web/components/ChatPanel.tsx`, using the mockup's `.chat`/`.messages`/`.chat-compose` markup (lines 269–278):

```typescript
"use client";

import { useState } from "react";

interface ChatMessage {
  who: "user" | "agent";
  text: string;
  time: string;
}

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { who: "agent", text: "Ready when you are. I can pay approved vendors using the policy on the left.", time: now() },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setMessages((prev) => [...prev, { who: "user", text, time: now() }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [...prev, { who: "agent", text: data.reply, time: now() }]);
    } catch (err) {
      setMessages((prev) => [...prev, { who: "agent", text: `Something went wrong reaching the agent: ${(err as Error).message}`, time: now() }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="chat-agent">
          <div className="agent-avatar">✦</div>
          <div>
            <strong>TopUp Agent</strong>
            <div className="online">● Online · policy enforced</div>
          </div>
        </div>
      </div>
      <div className="messages">
        {messages.map((m, i) => (
          <div className={`message ${m.who === "user" ? "user" : ""}`} key={i}>
            <div className={m.who === "user" ? "avatar" : "agent-avatar"}>{m.who === "user" ? "EK" : "✦"}</div>
            <div>
              <div className="bubble">{m.text}</div>
              <div className="msg-time">{m.time}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="quick-actions">
        <button onClick={() => send("Pay 5 USDT to Airtime vendor")}>Pay 5 USDT</button>
        <button onClick={() => send("Send 500 USDT to Airtime vendor")}>Try 500 USDT</button>
      </div>
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell the agent what to pay..."
          autoComplete="off"
        />
        <button className="send" type="submit" disabled={busy}>
          ↑
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Slot it into the page**

In `web/app/page.tsx`, place `<ChatPanel />` inside the `.workspace` panel alongside `<ChainState />`, matching the mockup's `.workspace` grid (a `.chat` div and a `.chain-state` aside as its two children — line 268).

- [ ] **Step 3: Manual verification — the actual demo flow**

```bash
cd ~/Documents/guardrail/web
npm run dev
```

With a policy applied (Task 9) and the vault funded with mUSDT (mint some via `cast send <MockUSDT address> "mint(address,uint256)" <vault address> 1000000000 --rpc-url https://testnet.hsk.xyz --private-key <any funded key>` — 1000000000 = 1000.00 mUSDT at 6 decimals), walk through: "Pay 5 USDT" twice (both approved), "Try 500 USDT" (denied, reason shown, receipt feed updates), then manually revoke via the policy panel toggle and try another payment (denied with "policy inactive or revoked").

- [ ] **Step 4: Commit**

```bash
cd ~/Documents/guardrail
git add web/components/ChatPanel.tsx web/app/page.tsx
git commit -m "Add chat panel wired to the agent API route"
```

---

## Task 13: Docs and demo script

**Files:**
- Modify: `README.md` (repo root)
- Create: `TECHNICAL.md` (repo root)
- Create: `docs/DEMO_SCRIPT.md`

- [ ] **Step 1: Update the root README**

Read the current `README.md` (written by the contracts subagent) and extend it — don't replace what's accurate — adding: a one-paragraph project summary matching the spec's Summary section, a `web/` setup section (`cd web && npm install && cp .env.local.example .env.local` then fill in keys, `npm run dev`), the deployed contract addresses from `docs/superpowers/plans/deployment-addresses.md`, and a link to `TECHNICAL.md` and `docs/DEMO_SCRIPT.md`.

- [ ] **Step 2: Write `TECHNICAL.md`**

Cover, concretely (pull directly from `docs/superpowers/specs/2026-08-26-guardrail-design.md`, don't re-derive): the policy-enforcement design and the non-revert-on-denial rationale (quote the NatSpec comment from `contracts/AgentVault.sol`), the full contract interface (function signatures from `web/lib/abi.ts`), why HSK testnet + a mock token (cite the 2026-08-26 research finding that no HSK testnet stablecoin could be confirmed), the two-wallet agent model (owner vs. agent hot wallet), and known limitations (single agent per vault, frontend-config allowlist labels rather than onchain metadata, no persistent database).

- [ ] **Step 3: Write the demo script**

Create `docs/DEMO_SCRIPT.md` with a word-for-word script for the three-minute demo, structured in beats:

```markdown
# Guardrail — 3-Minute Demo Script

**Setup (before judges arrive):** vault funded with mUSDT, policy applied
(max/tx 10 USDT, daily cap 20 USDT, 2 allowlisted recipients), wallet
connected, dev server running, browser at the dashboard.

## Beat 1 — Two successful payments (30s)
Say: "This is Guardrail — a vault that lets an AI agent spend money, but
only inside rules the owner sets onchain." Type into chat: "Pay 5 USDT to
Airtime vendor." Wait for approval, point at the receipt feed row appearing.
Repeat once more.

## Beat 2 — The denial (30s)
Say: "Now watch what happens when the agent gets asked to do something it
shouldn't." Type: "Send 500 USDT to Airtime vendor." Point at the chat
reply (denied, reason shown) and the new red row in the receipt feed. Say:
"The agent tried. The contract said no. That's the whole pitch."

## Beat 3 — Revoke (20s)
Click the policy toggle to revoke. Type another payment request in chat.
Point at the denial: "policy inactive or revoked." Say: "The owner can kill
this instantly, mid-conversation."

## Beat 4 — Wrap (10s)
Point at the contract address / Blockscout link: "Every one of those
receipts is a real onchain event on HashKey Chain testnet, not a UI
mock."
```

- [ ] **Step 4: Rehearse**

Run through `docs/DEMO_SCRIPT.md` twice against the actual running app, timing it. Note and fix anything that doesn't match reality (a button label that changed, a reason string that reads awkwardly out loud, timing that runs long).

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/guardrail
git add README.md TECHNICAL.md docs/DEMO_SCRIPT.md
git commit -m "Add technical doc, demo script, and update README"
git push origin main
```

---

## Self-review notes

- **Spec coverage:** every component in the approved design (deploy, contract client, agent wallet, agent API route, wallet provider, policy panel, stat tiles, chain state, receipt feed, chat panel, README/TECHNICAL/demo script) has a task above.
- **Non-revert-on-denial consistency:** `parsePaymentAttempt`/`payViaAgent` (Task 5), the API route (Task 6), and the receipt feed (Task 11) all treat the `PaymentAttempt` event's `approved` field — not transaction success — as the source of truth, matching the contract's actual behavior verified by reading `contracts/AgentVault.sol` directly rather than assuming the original brief's revert language.
- **Open item resolved:** the design spec left "allowlist label mechanism" open; this plan resolves it as frontend config (Task 4), consistent with the spec's stated default.
