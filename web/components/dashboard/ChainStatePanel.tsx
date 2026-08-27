"use client";

import { AGENT_VAULT_ADDRESS } from "@/lib/contracts";
import { usePolicyData } from "@/lib/usePolicyData";
import { PLACEHOLDER, formatAmount } from "@/lib/format";

export function ChainStatePanel() {
  const { policy, dailySpentToday, isLoading } = usePolicyData();

  const dailyCap = policy?.dailyCap;
  let usagePercent = 0;
  if (dailyCap !== undefined && dailySpentToday !== undefined && dailyCap > 0n) {
    const raw = Number((dailySpentToday * 10000n) / dailyCap) / 100;
    usagePercent = Math.min(100, Math.max(0, raw));
  }

  // Distinguish "we don't know yet" (still loading, or the first read
  // failed) from a real, confirmed revoke — showing "REVOKED" for an
  // unknown state would falsely imply the owner took that action.
  const statusLabel =
    isLoading || !policy ? PLACEHOLDER : policy.active ? "● ACTIVE" : "● REVOKED";

  return (
    <aside className="chain-state">
      <div className="chain-state-head">
        <div className="panel-title">Vault status</div>
        <span className="state-badge">{statusLabel}</span>
      </div>
      <div className="vault-address">CONTRACT ADDRESS</div>
      <div className="address">
        <span>{AGENT_VAULT_ADDRESS}</span>
        <button className="copy">Copy</button>
      </div>
      <div className="usage">
        <div className="usage-head">
          <span>Daily usage</span>
          <strong>
            <span>{isLoading ? PLACEHOLDER : formatAmount(dailySpentToday)}</span>{" "}
            / <span>{isLoading ? PLACEHOLDER : formatAmount(dailyCap)}</span> USDT
          </strong>
        </div>
        <div className="bar">
          <i style={{ width: `${usagePercent}%` }}></i>
        </div>
      </div>
      <div className="chain-events">
        <div className="chain-event">
          <div className="event-icon">✓</div>
          <div>
            <b>Policy enforced</b>
            <br />
            Every payment is checked before signing
          </div>
        </div>
        <div className="chain-event">
          <div className="event-icon">↻</div>
          <div>
            <b>Instant revoke</b>
            <br />
            Owner can disable the key at any time
          </div>
        </div>
        <div className="chain-event">
          <div className="event-icon">⌁</div>
          <div>
            <b>Event streaming</b>
            <br />
            Listening for vault activity
          </div>
        </div>
      </div>
    </aside>
  );
}
