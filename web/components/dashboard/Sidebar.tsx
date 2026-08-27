"use client";

import { useAccount, useBlockNumber } from "wagmi";

function truncate(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function initials(address: string) {
  // No name to derive initials from — just the first two hex chars after
  // 0x, which is at least tied to the real connected address rather than a
  // fixed persona.
  return address.slice(2, 4).toUpperCase();
}

export function Sidebar() {
  // Real, live block number instead of the mockup's frozen placeholder —
  // worth doing since the receipt feed right next to this panel shows real,
  // changing block numbers; a static fake one here would visibly contradict
  // it during the demo.
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { address, isConnected } = useAccount();

  return (
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
        <button>
          <span className="icon">◈</span>
          <span>Policies</span>
        </button>
        <button>
          <span className="icon">↗</span>
          <span>Transactions</span>
        </button>
        <button>
          <span className="icon">⚙</span>
          <span>Settings</span>
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="network-card">
          <div className="network-top">
            <span className="network-label">Network</span>
            <i className="live-dot"></i>
          </div>
          <div className="network-value">HSK Chain</div>
          <div className="network-sub">
            Testnet ·{" "}
            {blockNumber !== undefined
              ? `Block #${blockNumber.toLocaleString()}`
              : "connecting..."}
          </div>
        </div>
        <div className="account">
          <div className="avatar">{isConnected && address ? initials(address) : "?"}</div>
          <div>
            <strong>
              {isConnected && address ? truncate(address) : "Not connected"}
            </strong>
            <small>{isConnected ? "Owner account" : "Connect a wallet"}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
