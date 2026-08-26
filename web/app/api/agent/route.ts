import "server-only";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { formatUnits, parseUnits } from "viem";
import { resolveRecipient } from "@/lib/allowlist";
import { payViaAgent, PaymentAttemptNotFoundError } from "@/lib/agentWallet";

// mUSDT (the demo token used by the vault) has 6 decimals.
const MUSDT_DECIMALS = 6;

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are Guardrail's payment agent. You act on behalf of a user to send mUSDT payments out of their AgentVault.

The vault smart contract — not you — is the source of truth on spending limits (max per transaction, daily cap, expiry, and an allowlist of approved recipients). You do not know its exact limits in advance, and you should not pre-judge whether a payment will succeed or refuse to try because you think it might be denied. Always attempt the payment the user asks for by calling the pay tool, then report back the vault's real decision (approved or denied, and why) once you have it.

The one thing you should check yourself before calling pay is whether you can identify the recipient at all — if the user's message doesn't give you enough to resolve a recipient, ask them to clarify instead of guessing.

Keep every reply short: 1-2 sentences, suitable for a chat bubble. No preamble, no markdown formatting.`;

const PAY_TOOL: Anthropic.Tool = {
  name: "pay",
  description:
    "Attempt to send a payment from the vault to a recipient. The vault contract enforces spending limits and will approve or deny the payment; this tool reports the real outcome, it does not decide it.",
  input_schema: {
    type: "object",
    properties: {
      recipient: {
        type: "string",
        description:
          "Who to pay — a recipient label (e.g. 'Airtime vendor') or a 0x address.",
      },
      amount: {
        type: "number",
        description: "Amount to pay, in mUSDT (e.g. 5 for 5 mUSDT).",
      },
      reason: {
        type: "string",
        description: "Short reason for the payment, e.g. 'top-up'.",
      },
    },
    required: ["recipient", "amount", "reason"],
  },
};

export interface AgentPaymentResult {
  approved: boolean;
  amount: string;
  reason: string;
  recipient: string;
  txHash?: string;
}

export interface AgentChatResponse {
  reply: string;
  payment: AgentPaymentResult | null;
}

function textFromContent(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message =
    typeof body === "object" && body !== null && "message" in body
      ? (body as { message: unknown }).message
      : undefined;

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing required field: message (string)" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Agent chat is not configured on this server." },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: message },
  ];

  let firstResponse: Anthropic.Message;
  try {
    firstResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [PAY_TOOL],
      messages,
    });
  } catch (err) {
    console.error("agent route: initial Claude call failed", err);
    return NextResponse.json(
      { error: "Failed to reach the payment agent." },
      { status: 502 }
    );
  }

  const toolUse = firstResponse.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  // Claude answered without calling the tool — just relay its text.
  if (!toolUse || firstResponse.stop_reason !== "tool_use") {
    const reply = textFromContent(firstResponse.content);
    return NextResponse.json<AgentChatResponse>({
      reply: reply || "Sorry, I didn't catch that — could you rephrase?",
      payment: null,
    });
  }

  const input = toolUse.input as {
    recipient?: unknown;
    amount?: unknown;
    reason?: unknown;
  };
  const recipientInput = typeof input.recipient === "string" ? input.recipient : "";
  const amountInput = typeof input.amount === "number" ? input.amount : NaN;
  const reasonInput = typeof input.reason === "string" ? input.reason : "";

  let toolResultContent: string;
  let payment: AgentPaymentResult | null = null;

  const resolved = resolveRecipient(recipientInput);

  if (!Number.isFinite(amountInput) || amountInput <= 0) {
    toolResultContent = JSON.stringify({
      ok: false,
      error: `Invalid amount "${String(input.amount)}" — no payment was attempted.`,
    });
  } else if (!resolved) {
    // Unresolvable recipient — never touch the chain.
    toolResultContent = JSON.stringify({
      ok: false,
      error: `Recipient "${recipientInput}" is unknown or not allowlisted — no payment was attempted.`,
    });
  } else {
    try {
      const amountUnits = parseUnits(String(amountInput), MUSDT_DECIMALS);
      const outcome = await payViaAgent(
        resolved.address as `0x${string}`,
        amountUnits,
        reasonInput
      );

      payment = {
        approved: outcome.approved,
        amount: formatUnits(outcome.amount, MUSDT_DECIMALS),
        reason: outcome.reason,
        recipient: resolved.label ?? resolved.address,
        txHash: outcome.txHash,
      };

      toolResultContent = JSON.stringify({
        ok: true,
        approved: outcome.approved,
        amount: payment.amount,
        reason: outcome.reason,
        recipient: payment.recipient,
        txHash: outcome.txHash,
      });
    } catch (err) {
      if (err instanceof PaymentAttemptNotFoundError) {
        console.error("agent route: PaymentAttemptNotFoundError", err);
        payment = {
          approved: false,
          amount: String(amountInput),
          reason: "chain error",
          recipient: resolved.label ?? resolved.address,
        };
        toolResultContent = JSON.stringify({
          ok: false,
          error:
            "The payment transaction was submitted and mined, but we couldn't confirm its outcome from the chain. It may not have gone through as expected.",
        });
      } else {
        console.error("agent route: payViaAgent chain call failed", err);
        payment = {
          approved: false,
          amount: String(amountInput),
          reason: "chain error",
          recipient: resolved.label ?? resolved.address,
        };
        toolResultContent = JSON.stringify({
          ok: false,
          error:
            "We couldn't complete this payment the way you'd expect — there was a problem submitting the transaction to the chain.",
        });
      }
    }
  }

  messages.push({ role: "assistant", content: firstResponse.content });
  messages.push({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: toolResultContent,
      },
    ],
  });

  let finalResponse: Anthropic.Message;
  try {
    finalResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [PAY_TOOL],
      messages,
    });
  } catch (err) {
    console.error("agent route: follow-up Claude call failed", err);
    return NextResponse.json(
      { error: "Failed to reach the payment agent." },
      { status: 502 }
    );
  }

  const reply = textFromContent(finalResponse.content);

  return NextResponse.json<AgentChatResponse>({
    reply: reply || "Sorry, something went wrong relaying that reply.",
    payment,
  });
}
