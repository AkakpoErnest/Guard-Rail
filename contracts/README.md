# Guardrail contracts

`AgentVault.sol` is a spend-policy vault: the owner deposits an ERC20 token
(`MockUSDT.sol` / mUSDT on testnet) and grants individual agent addresses a
narrow, revocable `Policy` — a per-transaction cap, a rolling daily cap, an
address allowlist, and an expiry. Agents call `agentPay` themselves; the
vault enforces the policy and moves funds only when every check passes.

## Why `agentPay` does not revert on a policy denial

The project brief has two requirements that pull in opposite directions if
taken literally:

1. Reject a payment "on violation" of the policy.
2. Emit an event on **every** attempt — approved *and* denied — so the UI
   can show a full audit trail of what an agent tried to do.

Solidity events are only persisted if the transaction that emitted them
succeeds. If `agentPay` reverted on a policy violation, the
`PaymentAttempt(approved: false, ...)` event emitted right before the revert
would be rolled back along with everything else — it would never appear in a
block, and the UI could never query it. That defeats requirement (2), which
is the whole point of an onchain audit trail for agent spending.

So `AgentVault` resolves the conflict by making requirement (2) the
authoritative one: **`agentPay` treats a policy violation as a normal,
successfully-mined outcome**, not an exceptional one. On denial it:

- emits `PaymentAttempt(agent, to, amount, approved: false, reason)`,
- moves no funds,
- returns `false`,
- does **not** revert.

`agentPay` still reverts for conditions that are outside the policy surface
and genuinely exceptional — e.g. the underlying `token.transfer` call itself
failing. Those aren't things a UI needs to show as "the agent tried to
overspend"; they're infrastructure failures.

The net effect matches the intent of "reject payments that violate policy":
no denied `agentPay` call ever moves funds. It just does so via an `if`
check and an early `return false` instead of `require`/`revert`, so the
denial itself is durably logged onchain and queryable via `PaymentAttempt`
events (or via `getPolicy` / `dailySpentToday` for current state).

## Other notes

- `MockUSDT.mint` is deliberately unrestricted — it's a testnet faucet, not
  something that should ever exist in a production ERC20.
- Daily spend tracking uses UTC calendar days (`block.timestamp / 1 days`),
  not a rolling 24h window from each payment. `dailySpent` is reset lazily,
  the first time a new day is observed (in `agentPay`'s day check and in the
  `dailySpentToday` view), rather than via a cron/keeper.
- `setPolicy` is a full replace of an agent's policy (maxPerTx, dailyCap,
  allowlist, expiry) but intentionally does **not** reset `dailySpent` /
  `lastSpendDay`, so re-issuing a policy mid-day can't be used to bypass the
  daily cap an agent has already partially spent against.
