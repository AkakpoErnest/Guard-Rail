# Guardrail — 3-Minute Demo Script

Rehearse this twice, start to finish, before presenting — once to confirm
the mechanics still work against live testnet state, once to get the
timing and narration smooth. Re-run the pre-demo checklist before each
rehearsal and before the real thing, since spending during rehearsal
changes the numbers below.

## Pre-demo checklist (run through before judges arrive)

All three items were checked live against HSK Testnet on 2026-08-27
(commands included so you can re-check right before you present — the
numbers **will** have moved if you've rehearsed since).

**1. Gas funds on both wallets.**

```bash
cast balance 0xa2DAd004994869dD25BEb7a7655004CEa9370305 --rpc-url https://testnet.hsk.xyz   # owner/deployer wallet
cast balance 0x36431B95b1C6490C25B2cd1594Dd40FD15EA43F3 --rpc-url https://testnet.hsk.xyz   # agent wallet
```

As last checked: owner ≈ 0.078 HSK, agent ≈ 0.019 HSK — both enough for a
handful of transactions. If either is low, top up from
https://hsk.xyz/faucet before presenting. Confirm your browser wallet
(MetaMask or whatever you connect with) is on **HashKey Chain Testnet,
chain ID 133**, and is the same address as the deployer/owner above —
`setPolicy`/`revoke` will fail (or silently apply to the wrong policy) if
you're connected as any other account.

**2. Vault has enough mUSDT to pay out.**

```bash
cast call 0x7509D67775132c43974D69D61eA75Fd0e1A1D5f2 "balanceOf(address)(uint256)" \
  0x2b7A01CCE709c403478B878904F2cec64E02c63b --rpc-url https://testnet.hsk.xyz
```

As last checked: `980000000` raw units = **980.0 mUSDT** (6 decimals).
Comfortably enough for the two 5 mUSDT payments in this script (the denied
500 mUSDT attempt moves no funds regardless). You can also just glance at
the "Available balance" stat tile on the dashboard instead of running this.

**3. The important one — apply a fresh policy with real headroom.**

```bash
cast call 0x2b7A01CCE709c403478B878904F2cec64E02c63b "dailySpentToday(address)(uint256)" \
  0x36431B95b1C6490C25B2cd1594Dd40FD15EA43F3 --rpc-url https://testnet.hsk.xyz
cast call 0x2b7A01CCE709c403478B878904F2cec64E02c63b "getPolicy(address)(uint256,uint256,uint256,bool,uint256,uint256,address[])" \
  0x36431B95b1C6490C25B2cd1594Dd40FD15EA43F3 --rpc-url https://testnet.hsk.xyz
```

As last checked (2026-08-27, ~11:11 UTC): `dailySpentToday` = `20000000`
(**20.0 mUSDT**) against a `dailyCap` of `20000000` (**20.0 mUSDT**) —
**the daily cap is fully used up** from earlier live testing.
`dailySpent` only resets on UTC-day rollover, not when you call
`setPolicy` again (deliberate — see `TECHNICAL.md`) — so if you skip this
step, **both "Pay 5 USDT" attempts below will come back denied with
"amount exceeds dailyCap"** instead of approved, and the demo falls flat.

Fix, right before presenting:

1. Open the dashboard, connect the owner wallet.
2. In the **Active policy** panel (left side), drag **Daily spending
   cap** up to **50 USDT**. Leave **Max per transaction** at its default
   **10 USDT** — the 500 USDT denial later depends on that staying low.
3. Click **Apply policy onchain**, confirm the transaction in your wallet,
   wait for it to confirm (the toggle/status settles, no more "Applying...").

This sets a new `dailyCap` of 50 mUSDT. Because already-spent amounts
carry over, your real remaining headroom right after applying is
`50 − 20 = 30 mUSDT` — comfortably more than the `10 mUSDT` the two demo
payments need. If you rehearse again after this, re-run the
`dailySpentToday` check above and bump `dailyCap` again if it's gotten
close to the new cap.

---

## The script

Target: ~3:00, realistic budget up to ~3:45. Every payment message goes
through a real round trip — Claude deciding to call the pay tool, then a
real onchain transaction — which typically takes **10-15 seconds each**,
not instant. The timings below already build that in; don't try to talk
faster to compensate, just let the wait happen and narrate through it (see
"If a response is slow" below). Two approved payments come before the
denial deliberately — they establish that this is a normal, working
payment flow, so the denial lands as a contrast, not a coincidence. It's
still the moment the script is built around, not the opener.

**If you're running behind by 1:30** (i.e. you haven't reached the denial
yet), skip the second approved payment's narration — click "Pay 5 USDT"
silently while saying "one more, quickly" — and move straight to the
denial. Don't cut the denial, the revoke, or the dead-agent beat; those
three are the actual demo. The two openers are the only compressible part.

### [0:00–0:20] Open on the dashboard

**Say:**
> "This is Guardrail — a spend-policy vault for AI agents. The vault owns
> the money, not the agent. On the left is the policy the owner has set
> for this agent right now: ten USDT max per transaction, fifty USDT a
> day, two allowlisted recipients, and it's active. On the right is a chat
> agent that can actually spend from this vault — live, on HashKey Chain
> testnet — and a receipt feed showing every payment attempt it's ever
> made, approved or denied."

**Do:** Have the dashboard already loaded at `http://localhost:3000` (or
your deployed URL), owner wallet connected, Policy Panel visible showing
Max per transaction = 10 USDT, Daily spending cap = 50 USDT (from the
checklist above). Point at the "Available balance" stat tile (~980 USDT).

### [0:20–0:55] First approved payment

**Say:**
> "Let's have the agent pay our airtime vendor five USDT."

**Do:** In the chat panel, click the **"Pay 5 USDT"** quick-action button
(sends the message *"Pay 5 USDT to Airtime vendor"*). Wait for the agent's
reply.

**Say (once the reply lands):**
> "The agent didn't just decide that was fine — it called the vault
> onchain, and the vault checked the policy itself. Here's the receipt."

**Do:** Point at the new row at the top of the **Live receipt feed** —
green "✓ Approved", "Airtime vendor", "5.00 USDT", block number.

### [0:55–1:25] Second approved payment

**Say:**
> "One more, so it's clear this isn't a one-off."

**Do:** Click **"Pay 5 USDT"** again. Wait for the reply and the second
green row in the receipt feed.

**Say:**
> "Two approved payments, ten USDT total, both logged onchain — we've
> used ten of our fifty USDT daily budget."

### [1:25–2:00] The denial — the centerpiece

**Say:**
> "Now watch what happens when the agent tries something it shouldn't.
> I'm going to ask it to send five hundred USDT — way over the ten USDT
> per-transaction limit the owner set."

**Do:** Click the **"Try 500 USDT"** quick-action button (sends *"Send 500
USDT to Airtime vendor"*). Wait for the reply.

**Say (once the reply lands, before pointing at the feed):**
> "The agent tried — it always tries, and lets the contract decide. It
> didn't get to guess whether this would work."

**Do:** Point at the new row in the receipt feed: red "× Denied",
"Airtime vendor", "500.00 USDT", reason column reading **"amount exceeds
maxPerTx"**.

**Say:**
> "That denial isn't the app being polite and refusing to send the
> transaction — the transaction went through, onchain, and the vault
> contract itself rejected the payment and logged exactly why. No funds
> moved. Even if this chat agent were compromised, or Claude were
> convinced by some malicious prompt to try to drain the vault, this line
> in `AgentVault.sol` is what actually stops it — not the AI's judgment."

### [2:00–2:35] Revoke, mid-conversation

**Say:**
> "And the owner can pull the plug at any time, without touching the
> agent at all."

**Do:** In the **Active policy** panel, click **"Revoke agent access"**.
Confirm the transaction in your wallet. Wait for it to confirm — the
toggle switches off and the **Vault status** badge (Chain State panel)
flips from "● ACTIVE" to "● REVOKED".

**Say (while that confirms):**
> "This is a completely separate transaction, signed by the owner's own
> wallet — the agent's key had nothing to do with it and can't stop it."

### [2:35–2:55] The agent goes dead

**Say:**
> "Now let's ask the agent for a payment that would have worked a minute
> ago."

**Do:** Click **"Pay 5 USDT"** one more time. Wait for the reply and the
new receipt row: red "× Denied", reason **"policy inactive or revoked"**.

**Say:**
> "Same five-USDT request that succeeded twice already — now denied,
> instantly, the moment the owner revoked. The agent's key still exists,
> it can still try, but the vault won't let it move a cent."

### [2:55–3:00] Close

**Say:**
> "That's Guardrail: the AI agent gets to act autonomously, but the
> spending rules live in the contract holding the money, not in the
> agent's prompt — and the owner always keeps the last word."

---

## Notes for the presenter

- **If a chat response is slow** (Claude + an onchain wait can take
  10-15 real seconds, sometimes more), that's normal — just talk through
  what's happening rather than standing in silence: "it's submitting the
  transaction and waiting for it to mine now."
- **If a chat response genuinely fails, not just slow** — the app itself
  will show a clear error bubble within 30 seconds either way (a built-in
  timeout, so it can't hang forever). If that happens:
  1. Say something like "looks like the network's having a moment" —
     own it, don't apologize at length.
  2. Click the same quick-action button again once. Most transient RPC/API
     hiccups clear on retry.
  3. If it fails a second time, don't keep retrying live. Fall back to a
     **pre-recorded 60-90s screen capture of one full successful run**
     (record this during rehearsal, keep it cued up and ready) and narrate
     over it: "let me show you a run from earlier so we don't lose time"
     — then continue the live talk track over the recording. Judges care
     about seeing the mechanism work, not about zero hiccups on a public
     testnet.
- **"Reset demo"** in the chat panel clears the visible conversation and
  cancels any stuck in-flight request — it does NOT touch onchain state
  or the policy. Use it to recover the chat UI itself, not as a fix for a
  failed transaction.
- Rehearse this twice end-to-end before presenting, per the checklist
  above — timing and the exact wallet-confirmation clicks are the parts
  most likely to trip you up live. Record your second rehearsal; that
  recording is your contingency clip for the fallback above.
