"use client";

import { useState } from "react";

export function ChatPanel() {
  const [input, setInput] = useState("");

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="chat-agent">
          <div className="agent-avatar">✦</div>
          <div>
            <strong>TopUp Agent</strong>
            <div className="online">● Online · policy enforced</div>
          </div>
        </div>
        <button className="reset-btn">Reset demo</button>
      </div>
      <div className="messages">
        <div className="message">
          <div className="agent-avatar">✦</div>
          <div>
            <div className="bubble">
              Ready when you are. I can pay approved vendors using the policy
              on the left.
            </div>
            <div className="msg-time">10:42:01 AM</div>
          </div>
        </div>
        <div className="message user">
          <div className="avatar">EK</div>
          <div>
            <div className="bubble">Top up my line with 5 USDT</div>
            <div className="msg-time">10:42:14 AM</div>
          </div>
        </div>
        <div className="message">
          <div className="agent-avatar">✦</div>
          <div>
            <div className="bubble">
              Payment approved. 5 USDT sent to Airtime vendor.
            </div>
            <div className="msg-time">10:42:15 AM · Confirmed onchain</div>
          </div>
        </div>
      </div>
      <div className="quick-actions">
        <button>Pay 5 USDT</button>
        <button>Try 500 USDT</button>
        <button>Revoke access</button>
      </div>
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <input
          placeholder="Tell the agent what to pay..."
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="send" aria-label="Send">
          ↑
        </button>
      </form>
    </div>
  );
}
