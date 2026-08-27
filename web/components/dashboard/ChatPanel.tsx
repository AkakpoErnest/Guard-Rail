"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  time: string;
  meta?: string;
}

interface AgentPaymentResult {
  approved: boolean;
  amount: string;
  reason: string;
  recipient: string;
  txHash?: string;
}

interface AgentChatResponse {
  reply: string;
  payment: AgentPaymentResult | null;
}

function nowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function initialMessages(): ChatMessage[] {
  return [
    {
      role: "agent",
      text: "Ready when you are. I can pay approved vendors using the policy on the left.",
      time: nowTime(),
    },
  ];
}

function paymentMeta(payment: AgentPaymentResult): string {
  if (payment.approved) {
    return `Confirmed onchain · ${payment.amount} USDT to ${payment.recipient}`;
  }
  return `Policy violation · ${payment.reason}`;
}

const QUICK_ACTIONS: { label: string; message: string }[] = [
  { label: "Pay 5 USDT", message: "Pay 5 USDT to Airtime vendor" },
  { label: "Try 500 USDT", message: "Send 500 USDT to Airtime vendor" },
  {
    label: "Revoke access",
    message:
      "How do I revoke your access to the vault? Walk me through it.",
  },
];

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed, time: nowTime() },
    ]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const errorText =
          (body && typeof body.error === "string" && body.error) ||
          "Something went wrong reaching the agent.";
        setMessages((prev) => [
          ...prev,
          { role: "agent", text: errorText, time: nowTime() },
        ]);
        return;
      }

      const data: AgentChatResponse = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: data.reply,
          time: nowTime(),
          meta: data.payment ? paymentMeta(data.payment) : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: "Couldn't reach the agent — check your connection and try again.",
          time: nowTime(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setMessages(initialMessages());
    setInput("");
  }

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
        <button className="reset-btn" type="button" onClick={handleReset}>
          Reset demo
        </button>
      </div>
      <div className="messages" ref={messagesRef}>
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "message user" : "message"}
          >
            {m.role === "agent" ? (
              <div className="agent-avatar">✦</div>
            ) : (
              <div className="avatar">EK</div>
            )}
            <div>
              <div className="bubble">{m.text}</div>
              <div className="msg-time">
                {m.time}
                {m.meta ? ` · ${m.meta}` : ""}
              </div>
            </div>
          </div>
        ))}
        {sending && (
          <div className="message">
            <div className="agent-avatar">✦</div>
            <div>
              <div className="bubble">...</div>
            </div>
          </div>
        )}
      </div>
      <div className="quick-actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={sending}
            onClick={() => sendMessage(action.message)}
          >
            {action.label}
          </button>
        ))}
      </div>
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
      >
        <input
          placeholder="Tell the agent what to pay..."
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button className="send" aria-label="Send" disabled={sending}>
          ↑
        </button>
      </form>
    </div>
  );
}
