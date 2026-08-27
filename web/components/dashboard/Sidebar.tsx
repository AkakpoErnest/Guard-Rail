export function Sidebar() {
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
          <div className="network-sub">Testnet · Block #18,420,291</div>
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
