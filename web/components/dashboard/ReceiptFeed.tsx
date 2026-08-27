"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useWatchContractEvent,
  usePublicClient,
  type UseWatchContractEventParameters,
} from "wagmi";
import { formatUnits, getAbiItem, type Address } from "viem";
import { agentVaultAbi } from "@/lib/abi";
import { AGENT_VAULT_ADDRESS } from "@/lib/contracts";
import { ALLOWLIST_ENTRIES } from "@/lib/allowlist";
import { MUSDT_DECIMALS } from "@/lib/format";

// How far back to backfill on mount. The vault's real event history (from
// live testing in earlier tasks) all falls well within this window; going
// back further risks hitting the public HSK testnet RPC's block-range
// limits (an `earliest`-to-`latest` query outright times out — confirmed
// while building this component).
const BACKFILL_BLOCK_WINDOW = 100_000n;

// Cap how many backfilled rows we keep, newest-first.
const MAX_RECEIPTS = 20;

const paymentAttemptEvent = getAbiItem({
  abi: agentVaultAbi,
  name: "PaymentAttempt",
});

interface Receipt {
  approved: boolean;
  to: Address;
  amount: bigint;
  reason: string;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
}

/** Dedup key: a given onchain log is uniquely identified by its tx hash +
 * log index, whether we saw it via backfill or the live subscription. */
function receiptKey(r: Pick<Receipt, "txHash" | "logIndex">) {
  return `${r.txHash}:${r.logIndex}`;
}

function sortNewestFirst(a: Receipt, b: Receipt) {
  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber > b.blockNumber ? -1 : 1;
  }
  return b.logIndex - a.logIndex;
}

type PaymentAttemptLogs = Parameters<
  NonNullable<
    UseWatchContractEventParameters<typeof agentVaultAbi, "PaymentAttempt">["onLogs"]
  >
>[0];

function resolveRecipientLabel(address: string): string {
  const entry = ALLOWLIST_ENTRIES.find(
    (e) => e.address.toLowerCase() === address.toLowerCase()
  );
  if (entry) return entry.label;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ReceiptFeed() {
  const publicClient = usePublicClient();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isBackfilling, setIsBackfilling] = useState(true);

  // Dedup purely as a function of committed `prev` state (no external
  // mutable ref) so this stays correct under React Strict Mode's dev-time
  // double-invocation of state updaters, and so a live event that arrives
  // mid-backfill can't be double-counted regardless of invocation order.
  // useCallback'd with a stable identity (only touches the stable
  // setReceipts) so it can safely be a dependency of the live-subscription
  // handler below without changing on every render.
  const addReceipts = useCallback((incoming: Receipt[]) => {
    if (incoming.length === 0) return;
    setReceipts((prev) => {
      const existingKeys = new Set(prev.map(receiptKey));
      const toAdd = incoming.filter((r) => !existingKeys.has(receiptKey(r)));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd].sort(sortNewestFirst).slice(0, MAX_RECEIPTS);
    });
  }, []);

  // Backfill history on mount. useWatchContractEvent (below) only sees new
  // events from the moment it subscribes, so without this the feed would
  // start empty despite the vault already having real payment history.
  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;

    async function backfill() {
      try {
        const currentBlock = await publicClient!.getBlockNumber();
        const fromBlock =
          currentBlock > BACKFILL_BLOCK_WINDOW
            ? currentBlock - BACKFILL_BLOCK_WINDOW
            : 0n;

        const logs = await publicClient!.getLogs({
          address: AGENT_VAULT_ADDRESS,
          event: paymentAttemptEvent,
          fromBlock,
          toBlock: "latest",
        });

        if (cancelled) return;

        const parsed: Receipt[] = logs.map((log) => ({
          approved: log.args.approved ?? false,
          to: log.args.to ?? ("0x0000000000000000000000000000000000000000" as Address),
          amount: log.args.amount ?? 0n,
          reason: log.args.reason ?? "",
          blockNumber: log.blockNumber ?? 0n,
          txHash: log.transactionHash ?? "",
          logIndex: log.logIndex ?? 0,
        }));

        addReceipts(parsed);
      } catch (err) {
        console.error("ReceiptFeed: failed to backfill PaymentAttempt history", err);
      } finally {
        if (!cancelled) setIsBackfilling(false);
      }
    }

    backfill();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient]);

  // Live subscription for new events from here on out. onLogs is
  // useCallback'd (depending only on the already-stable addReceipts) rather
  // than defined inline: useWatchContractEvent includes onLogs in its
  // internal effect's dependency array, so a fresh function identity on
  // every render — which every processed event would otherwise trigger, via
  // the resulting setReceipts/re-render — tears down and rebuilds the whole
  // polling subscription (fresh filter, lost fromBlock continuity) instead
  // of reusing it. That adds a full extra polling interval of latency right
  // when back-to-back events are exactly what a demo needs to show promptly.
  const handleLogs = useCallback(
    (logs: PaymentAttemptLogs) => {
      const parsed: Receipt[] = logs.map((log) => ({
        approved: log.args.approved ?? false,
        to: log.args.to ?? ("0x0000000000000000000000000000000000000000" as Address),
        amount: log.args.amount ?? 0n,
        reason: log.args.reason ?? "",
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? "",
        logIndex: log.logIndex ?? 0,
      }));
      addReceipts(parsed);
    },
    [addReceipts]
  );

  useWatchContractEvent({
    address: AGENT_VAULT_ADDRESS,
    abi: agentVaultAbi,
    eventName: "PaymentAttempt",
    onLogs: handleLogs,
  });

  const rows = useMemo(() => receipts, [receipts]);

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
          <i></i> LIVE
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
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty">
                {isBackfilling
                  ? "Loading receipt history..."
                  : "No payment attempts yet."}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={receiptKey(r)}>
                <td>
                  <span className={`result ${r.approved ? "approved" : "denied"}`}>
                    {r.approved ? "✓ Approved" : "× Denied"}
                  </span>
                </td>
                <td>{resolveRecipientLabel(r.to)}</td>
                <td>{formatUnits(r.amount, MUSDT_DECIMALS)} USDT</td>
                <td>{r.reason}</td>
                <td className="hash">#{r.blockNumber.toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
