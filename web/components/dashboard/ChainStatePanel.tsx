"use client";

import { formatUnits } from "viem";
import { AGENT_VAULT_ADDRESS } from "@/lib/contracts";
import { usePolicyData } from "@/lib/usePolicyData";

const PLACEHOLDER = "—";

function formatAmount(value: bigint | undefined): string {
  if (value === undefined) return PLACEHOLDER;
  return Number(formatUnits(value, 6)).toFixed(2);
}

export function ChainStatePanel() {
  const { policy, dailySpentToday, isLoading } = usePolicyData();

  const dailyCap = policy?.dailyCap;
  let usagePercent = 0;
  if (dailyCap !== undefined && dailySpentToday !== undefined && dailyCap > 0n) {
    const raw = Number((dailySpentToday * 10000n) / dailyCap) / 100;
    usagePercent = Math.min(100, Math.max(0, raw));
  }

  const isActive = policy?.active ?? false;

  return (
    <aside className="chain-state">
      <div className="chain-state-head">
        <div className="panel-title">Vault status</div>
        <span className="state-badge">
          {isLoading
            ? PLACEHOLDER
            : isActive
              ? "● ACTIVE"
              : "● REVOKED"}
        </span>
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
