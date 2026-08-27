# Guardrail — Technical Overview

This is the technical companion to the [README](README.md). It covers the
architecture, the real contract interface, the two design decisions that
matter most (non-revert-on-denial, the two-wallet model), and an honest
list of known limitations.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Next.js app (web/)                                                  │
│                                                                        │
│  Owner's browser                                                      │
│   - RainbowKit connect button (web/components/dashboard/Topbar.tsx)  │
│   - PolicyPanel.tsx: wagmi useWriteContract → setPolicy / revoke ────┼──┐
│   - StatTiles.tsx, ChainStatePanel.tsx: usePolicyData.ts (wagmi       │  │
│     useReadContracts, 5s poll) → getPolicy, dailySpentToday          │  │
│                                                                        │  │
│  ChatPanel.tsx ──POST /api/agent──▶ app/api/agent/route.ts           │  │
│                                       (Claude tool-use loop,          │  │
│                                        one tool: "pay")               │  │
│                                            │                          │  │
│                                            ▼                          │  │
│                                   lib/agentWallet.ts                  │  │
│                                   payViaAgent() — viem walletClient   │  │
│                                   signs with AGENT_PRIVATE_KEY  ──────┼──┤
│                                            │                          │  │
│  ReceiptFeed.tsx ◀── backfill (getLogs) + live useWatchContractEvent │  │
│    watches PaymentAttempt                                            │  │
└────────────────────────────────────────────────────────────────────┘  │
                                            │                             │
                                            ▼                             ▼
                                   AgentVault.sol  (HSK testnet, chain 133)
                                    ├─ setPolicy / revoke   (owner-only)
                                    ├─ agentPay             (policy-holder only)
                                    ├─ getPolicy / dailySpentToday / isAllowlisted (views)
                                    └─ emits PolicySet / PolicyRevoked / PaymentAttempt
                                            │
                                            ▼
                                   MockUSDT.sol (mUSDT, 6 decimals, public mint())
```

Two separate signing identities, kept structurally apart:

- **Owner** — the user's real wallet, connected in the browser via
  RainbowKit/wagmi. Signs `setPolicy` and `revoke`. Never touches
  `agentPay`.
- **Agent** — a dedicated hot wallet whose private key
  (`AGENT_PRIVATE_KEY`) lives only in `web/.env.local`, read only by the
  server-side API route (`web/app/api/agent/route.ts` → `web/lib/agentWallet.ts`,
  both marked `"server-only"`). It's the only signer that can call
  `agentPay`, and only within whatever policy is currently active for its
  address.

### Real file layout (`web/`)

```
app/
  page.tsx                       dashboard page, composes all components
  api/agent/route.ts             Claude tool-use chat endpoint (the only
                                  place AGENT_PRIVATE_KEY is used)
components/dashboard/
  Sidebar.tsx                    static nav + network card
  Topbar.tsx                     RainbowKit ConnectButton, chain pill
  StatTiles.tsx                  balance / spent-today / policy-status tiles
  PolicyPanel.tsx                sliders + Apply/Revoke, real setPolicy/revoke writes
  ChatPanel.tsx                  chat UI, quick actions, posts to /api/agent
  ChainStatePanel.tsx            vault status, contract address, usage bar
  ReceiptFeed.tsx                PaymentAttempt backfill + live subscription
components/providers/
  wallet-provider.tsx            wagmi + RainbowKit config (hashkey chains)
lib/
  abi.ts                         AgentVault + MockUSDT ABIs
  contracts.ts                   typed env-derived contract addresses
  chain.ts                       guardrailChain = viem's hashkeyTestnet
  agentWallet.ts                 payViaAgent(), PaymentAttempt log parsing
  allowlist.ts                   label ↔ address mapping (frontend config)
  usePolicyData.ts                 wagmi hook: policy + dailySpent + balance
  format.ts                      shared amount formatting / decimals constant
```

This matches what's actually in the repo (verified via `find`), not the
original design spec's file list, which is close but not identical — e.g.
the design doc didn't call out `lib/format.ts` or `lib/usePolicyData.ts`
as separate files; they were split out from `StatTiles`/`ChainStatePanel`
during implementation once the duplication showed up (see commit
`4fe326f`).

## Contract interface

From `contracts/AgentVault.sol` (verified against the deployed source, not
reconstructed from memory):

```solidity
function setPolicy(
    address agent,
    uint256 maxPerTx,
    uint256 dailyCap,
    address[] calldata allowlist,
    uint256 expiry
) external onlyOwner;

function revoke(address agent) external onlyOwner;

function agentPay(
    address to,
    uint256 amount,
    string calldata reason
) external returns (bool);

function getPolicy(address agent)
    external view
    returns (
        uint256 maxPerTx,
        uint256 dailyCap,
        uint256 expiry,
        bool active,
        uint256 dailySpent,
        uint256 lastSpendDay,
        address[] memory allowlist
    );

function dailySpentToday(address agent) external view returns (uint256);

function isAllowlisted(address agent, address to) external view returns (bool);

event PaymentAttempt(
    address indexed agent,
    address indexed to,
    uint256 amount,
    bool approved,
    string reason
);
event PolicySet(address indexed agent, uint256 maxPerTx, uint256 dailyCap, address[] allowlist, uint256 expiry);
event PolicyRevoked(address indexed agent);
```

`_checkPolicy` (internal) evaluates, in order: policy `active`, not past
`expiry`, recipient allowlisted, `amount <= maxPerTx`, and
`spentToday + amount <= dailyCap`. The first failing check determines the
`reason` string emitted in a denied `PaymentAttempt` (`"policy inactive or
revoked"`, `"policy expired"`, `"recipient not allowlisted"`, `"amount
exceeds maxPerTx"`, `"amount exceeds dailyCap"`).

## Design decision: `agentPay` does not revert on policy denial

This is the single most important technical decision in the project, so
it's worth explaining in full (the short version lives in
`contracts/README.md` and in the contract's own NatSpec).

The project's requirements pull in two directions if read literally:

1. Reject a payment that violates the policy.
2. Emit an event on *every* attempt — approved and denied — so the UI can
   show a full audit trail of what the agent tried to do.

Solidity only persists events from a transaction that succeeds. If
`agentPay` reverted on a policy violation (the naive reading of
requirement 1, `require(...)`/`revert`), the `PaymentAttempt(approved:
false, ...)` event emitted right before that revert would be rolled back
along with the rest of the transaction's state changes. It would never
land in a block, and no indexer or frontend could ever query it. That
defeats requirement 2 outright — there would be no onchain record that the
agent ever tried the oversized payment, which is the entire point of a
denial-first demo.

So `AgentVault` treats a policy violation as an ordinary, successfully
mined outcome, not an exceptional one. On denial, `agentPay`:

- emits `PaymentAttempt(agent, to, amount, approved: false, reason)`,
- moves no funds,
- returns `false`,
- does **not** revert.

It still reverts for conditions genuinely outside the policy surface — the
only case in the current contract is the underlying `token.transfer` call
itself failing (`require(sent, "AgentVault: token transfer failed")`).
That's an infrastructure failure, not "the agent tried to overspend," so
there's no audit-trail reason to keep it non-reverting.

The net effect still matches the *intent* of "reject payments that violate
policy" — no denied call ever moves funds — it's just implemented as an
`if` check with an early `return false` instead of `require`/`revert`, so
the denial is durably logged and queryable via `PaymentAttempt` events (or
via `getPolicy`/`dailySpentToday` for current state).

One consequence worth calling out explicitly: because `agentPay` never
reverts on denial, **a successful transaction (no revert) is not
sufficient to know a payment was approved.** The frontend and the chat API
route both treat the `PaymentAttempt` event's `approved` field, decoded
from the transaction receipt, as the sole source of truth for the outcome
(`web/lib/agentWallet.ts`'s `parsePaymentAttempt`). Checking `receipt.status
=== "success"` alone would be wrong — that's true for both approved *and*
denied attempts.

## The two-wallet model

- **Owner wallet** (browser, RainbowKit/wagmi): can call `setPolicy` and
  `revoke`. Cannot call `agentPay` in any way that matters — nothing stops
  the owner's address from calling it, but it would need its own policy to
  succeed, and the owner never sets one for itself in this app.
- **Agent wallet** (server-side, `AGENT_PRIVATE_KEY`): can call `agentPay`
  and only `agentPay`. It has no owner privileges — it cannot set or
  change its own policy, and it cannot revoke itself. It never holds
  vault funds directly; it only holds enough native HSK to pay gas for its
  own `agentPay` transactions. If the agent's key is somehow compromised,
  the attacker inherits exactly what the current policy allows — bounded
  by `maxPerTx`, `dailyCap`, the allowlist, and `expiry` — and nothing more,
  and the owner can `revoke` it at any time from a wallet the agent never
  had access to.

This separation is what makes "the agent can act autonomously but the
owner keeps the final say" actually true at the code level, not just in
the pitch: the two keys live in different trust domains (browser wallet
vs. server env var) and have disjoint capabilities on the contract.

## Testing

The contract has 10 Hardhat unit tests (`contracts/test/AgentVault.test.ts`,
run via `npm test` at the repo root), covering: a payment within policy
succeeding and transferring funds; each individual denial reason (over
`maxPerTx`, over `dailyCap`, non-allowlisted recipient, after `revoke`,
after `expiry`); two same-day payments correctly accumulating against the
daily cap; the daily counter resetting on UTC-day rollover; owner-only
access control on `setPolicy`/`revoke`; and a call from an address with no
policy at all.

What's deliberately out of scope for a hackathon timeline: no fuzz/invariant
testing (e.g. property-based tests hammering `setPolicy`/`agentPay` with
randomized inputs to look for edge cases the hand-written tests didn't
think of), and no tests run against the actual deployed bytecode on HSK
testnet (the deployed contract has instead been exercised through *real*
manual end-to-end use during development — genuine approved payments,
genuine denials, genuine revokes, all with real transaction hashes — which
catches integration issues the unit tests can't, but isn't a repeatable
automated suite). The web app (React components, the chat API route) has
no automated test suite at all; it was verified through direct manual and
scripted (headless-browser) checks against the live testnet deployment
during development, not through a checked-in test file.

## Known limitations

Being direct about what this is and isn't, since it was built under a
hackathon time budget:

- **Single agent per vault.** `AgentVault` stores one `Policy` per agent
  address, and the app is wired to exactly one hardcoded agent address
  (`NEXT_PUBLIC_AGENT_ADDRESS`). The contract itself would support
  multiple agents (it's a `mapping(address => Policy)`), but the UI and
  the chat route don't have any concept of "which agent" — there's only
  one.
- **Allowlist labels are frontend config, not onchain metadata.** The
  contract only stores addresses (`address[] allowlist` per policy,
  checked via `_isAllowlisted`). The human-readable labels ("Airtime
  vendor", "Data bundle API") shown in the UI and resolved from chat text
  live entirely in `web/lib/allowlist.ts`, a static array in the frontend.
  There's no onchain registry mapping an address to a name — anyone
  reading the chain sees only addresses.
- **`mUSDT` is a mock token, not real USDT.** HashKey Chain testnet has no
  confirmed USDT deployment (checked against HSK docs and the Blockscout
  testnet explorer during design), so `MockUSDT.sol` is a minimal
  OpenZeppelin ERC20 with a public, unrestricted `mint()` — explicitly
  testnet-only, and NatSpec-labeled as such in the contract. It would be a
  serious bug in any deployment where real funds were at stake.
- **No auth on the `/api/agent` chat route.** Anyone who can reach the
  endpoint (`POST /api/agent`) can send a message that causes the server's
  agent wallet to attempt a real, signed onchain transaction — there's no
  session check, API key, or rate limit in front of it. The only thing
  bounding the blast radius is the vault's own policy enforcement
  (`maxPerTx`, `dailyCap`, allowlist, expiry) — an attacker can make the
  agent *try* arbitrary payments, but the contract still decides whether
  any of them actually move funds. This is acceptable for a demo reachable
  only by the presenter, not for a production deployment.
- **`dailySpent` resets on UTC-day rollover, not on `setPolicy`.** This is
  deliberate (see `contracts/AgentVault.sol`'s `setPolicy` comment and
  `contracts/README.md`): if re-issuing a policy mid-day reset the
  counter, an owner could unintentionally (or an agent could induce them
  to) let an already-capped agent spend past its daily limit twice in one
  day by re-applying the same policy. The tradeoff is an operational
  quirk — raising a policy's `dailyCap` mid-day doesn't give you a full
  fresh budget, only the *new* cap minus whatever was already spent that
  UTC day. Anyone running the demo needs to account for this; see
  `docs/demo-script.md`'s pre-demo checklist.
- **The receipt feed's backfill window is bounded.** `ReceiptFeed.tsx`
  backfills `PaymentAttempt` history by querying the last
  `BACKFILL_BLOCK_WINDOW` (100,000) blocks on mount, then subscribes live
  from there. This is a deliberate tradeoff — querying `earliest` to
  `latest` in one call times out against the public HSK testnet RPC — but
  it means a `PaymentAttempt` event old enough to fall outside that window
  would not appear in the feed on a fresh page load (it would still exist
  onchain and be readable by directly querying logs at that block range;
  it just wouldn't be picked up by this UI's default backfill). Not
  currently an issue given how recently the vault was deployed and how
  much of its history is well within 100,000 blocks, but worth knowing
  about for a long-lived deployment.
- **No production security audit.** This is a testnet hackathon
  submission. The contract has a Hardhat test suite (10 tests, see
  `contracts/README.md` and the repo root's `npm test`) covering the
  policy-enforcement logic, but it hasn't been through external review.
