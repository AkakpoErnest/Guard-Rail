"use client";

import { useBlockNumber } from "wagmi";

export function Sidebar() {
  // Real, live block number instead of the mockup's frozen placeholder —
  // worth doing since the receipt feed right next to this panel shows real,
  // changing block numbers; a static fake one here would visibly contradict
  // it during the demo.
  const { data: blockNumber } = useBlockNumber({ watch: true });

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
          <div className="avatar">EK</div>
          <div>
            <strong>Ernest K.</strong>
            <small>Owner account</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
