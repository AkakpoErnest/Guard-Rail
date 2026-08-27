"use client";

import { AGENT_VAULT_ADDRESS } from "@/lib/contracts";

export function ChainStatePanel() {
  return (
    <aside className="chain-state">
      <div className="chain-state-head">
        <div className="panel-title">Vault status</div>
        <span className="state-badge">● ACTIVE</span>
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
            <span>10</span> / <span>20</span> USDT
          </strong>
        </div>
        <div className="bar">
          <i style={{ width: "50%" }}></i>
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
