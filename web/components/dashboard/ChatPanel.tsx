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

// How long to wait for /api/agent before giving up and letting the
// presenter retry. The Claude round-trip plus an onchain tx wait can
// legitimately take several seconds, but an unbounded wait risks leaving
// the UI stuck mid-demo with no way to recover short of a page reload.
const REQUEST_TIMEOUT_MS = 30_000;

function nowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

// No live timestamp here deliberately — this seeds useState's lazy
// initializer, which React also runs during server rendering. Calling
// nowTime() here would bake one timestamp string into the server-rendered
// HTML and produce a different one on client hydration a moment later,
// triggering a hydration mismatch. The real timestamp gets filled in by a
// client-only effect once mounted (see the effect below).
function initialMessages(): ChatMessage[] {
  return [
    {
      role: "agent",
      text: "Ready when you are. I can pay approved vendors using the policy on the left.",
      time: "",
    },
  ];
}

// The API route (web/app/api/agent/route.ts) uses this exact literal for
// both a mined-but-unreadable transaction and an outright chain/RPC
// submission failure — neither is a real policy decision from the vault,
// so it must not be labeled "Policy violation" alongside genuine denial
// reasons like "amount exceeds maxPerTx" or "policy inactive or revoked".
const CHAIN_ERROR_REASON = "chain error";

function paymentMeta(payment: AgentPaymentResult): string {
  if (payment.approved) {
    return `Confirmed onchain · ${payment.amount} USDT to ${payment.recipient}`;
  }
  if (payment.reason === CHAIN_ERROR_REASON) {
    return "Couldn't reach the chain — not a policy decision, try again";
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
  // Synchronous guard against a double-submit landing before React commits
  // the `sending` state update (e.g. a fast Enter-then-click, or key
  // repeat) — `sending` state alone isn't checked until the next render,
  // but this ref is checked and set immediately, in the same tick.
  const sendingRef = useRef(false);
  // Lets handleReset actually cancel an in-flight request, rather than just
  // clearing messages while a stale response is still on its way to land
  // on top of the freshly-reset conversation.
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fill in the seed message's real timestamp once mounted client-side —
  // see the comment on initialMessages() for why it starts blank.
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m, i) => (i === 0 && m.time === "" ? { ...m, time: nowTime() } : m))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Abort any in-flight request on unmount too, so a late response never
  // tries to update state after this component is gone.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;
    sendingRef.current = true;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: trimmed, time: nowTime() },
    ]);
    setInput("");
    setSending(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
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
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          text: timedOut
            ? "That took too long to come back — try again."
            : "Couldn't reach the agent — check your connection and try again.",
          time: nowTime(),
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      sendingRef.current = false;
      setSending(false);
    }
  }

  function handleReset() {
    abortControllerRef.current?.abort();
    sendingRef.current = false;
    setSending(false);
    setInput("");
    // Build the fresh seed message with a real timestamp directly — this
    // handler only runs client-side (it's a click handler), so no
    // hydration concern the way the initial-render seed has.
    setMessages(initialMessages().map((m, i) => (i === 0 ? { ...m, time: nowTime() } : m)));
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
