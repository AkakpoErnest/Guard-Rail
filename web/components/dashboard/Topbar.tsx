"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePolicyData } from "@/lib/usePolicyData";

export function Topbar() {
  const { policy, isLoading } = usePolicyData();
  const agentCountLabel =
    isLoading || !policy
      ? "checking agent..."
      : policy.active
        ? "1 active agent"
        : "0 active agents";

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">Spend policy wallet</div>
        <h1>Agent control center</h1>
        <div className="subtitle">
          Give your agent room to act. Keep the final say onchain.
        </div>
      </div>
      <div className="top-actions">
        <div className="chain-pill">
          <i className="live-dot"></i>
          <strong>HSK Chain</strong>
          <span>Connected</span>
        </div>
        <div className="agent-pill">
          ⌁ <span>{agentCountLabel}</span>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
