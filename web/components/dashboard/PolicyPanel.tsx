"use client";

import { useState } from "react";

export function PolicyPanel() {
  const [txCap, setTxCap] = useState(10);
  const [dailyCap, setDailyCap] = useState(20);
  const [active, setActive] = useState(true);

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-title">Active policy</span>
        <span className="panel-note">Last edited just now</span>
      </div>
      <div className="policy-body">
        <div className="policy-agent">
          <div className="agent-info">
            <div className="agent-avatar">✦</div>
            <div>
              <strong>TopUp Agent</strong>
              <small>agent_7f3...a91c</small>
            </div>
          </div>
          <button
            className={`toggle${active ? "" : " off"}`}
            aria-label="Toggle agent"
            onClick={() => setActive((a) => !a)}
          >
            <i></i>
          </button>
        </div>
        <div className="control">
          <div className="control-row">
            <label>Max per transaction</label>
            <span className="control-value">${txCap} USDT</span>
          </div>
          <input
            type="range"
            min={1}
            max={100}
            value={txCap}
            onChange={(e) => setTxCap(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>1 USDT</span>
            <span>100 USDT</span>
          </div>
        </div>
        <div className="control">
          <div className="control-row">
            <label>Daily spending cap</label>
            <span className="control-value">${dailyCap} USDT</span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            value={dailyCap}
            onChange={(e) => setDailyCap(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>5 USDT</span>
            <span>200 USDT</span>
          </div>
        </div>
        <div className="allowlist">
          <div className="allowlist-title">
            Allowed recipients{" "}
            <span style={{ color: "var(--dim)" }}>· 2 addresses</span>
          </div>
          <div className="recipient">
            <div className="recipient-left">
              <div className="recipient-mark">₦</div>
              <div>
                <strong>Airtime vendor</strong>
                <small>0x8a91...40b2</small>
              </div>
            </div>
            <button className="remove" title="Remove">
              ×
            </button>
          </div>
          <div className="recipient">
            <div className="recipient-left">
              <div className="recipient-mark">◒</div>
              <div>
                <strong>Data bundle API</strong>
                <small>0x2d70...bf18</small>
              </div>
            </div>
            <button className="remove" title="Remove">
              ×
            </button>
          </div>
          <button className="add-recipient">＋ Add recipient</button>
        </div>
        <div className="expiry">
          <span className="mini-icon">◷</span>
          <span>
            Policy expires in{" "}
            <b style={{ color: "var(--text)" }}>6 days, 14 hours</b>
          </span>
        </div>
      </div>
    </section>
  );
}
