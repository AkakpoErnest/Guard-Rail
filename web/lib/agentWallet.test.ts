import { describe, it, expect } from "vitest";
import { encodeEventTopics, encodeAbiParameters, type Log } from "viem";
import { agentVaultAbi } from "./abi";
import { parsePaymentAttempt } from "./agentWallet";

function buildPaymentAttemptLog(overrides: {
  agent: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  approved: boolean;
  reason: string;
}): Log {
  const topics = encodeEventTopics({
    abi: agentVaultAbi,
    eventName: "PaymentAttempt",
    args: { agent: overrides.agent, to: overrides.to },
  });
  const data = encodeAbiParameters(
    [
      { type: "uint256" },
      { type: "bool" },
      { type: "string" },
    ],
    [overrides.amount, overrides.approved, overrides.reason]
  );
  return {
    address: "0x000000000000000000000000000000000000dEaD",
    topics,
    data,
    blockNumber: 1n,
    blockHash: "0x" + "1".repeat(64),
    transactionHash: "0x" + "2".repeat(64),
    transactionIndex: 0,
    logIndex: 0,
    removed: false,
  } as Log;
}

describe("parsePaymentAttempt", () => {
  it("decodes an approved payment log", () => {
    const log = buildPaymentAttemptLog({
      agent: "0x100000000000000000000000000000000000000A",
      to: "0x200000000000000000000000000000000000000b",
      amount: 5000000n,
      approved: true,
      reason: "",
    });
    const result = parsePaymentAttempt([log]);
    expect(result).not.toBeNull();
    expect(result?.approved).toBe(true);
    expect(result?.amount).toBe(5000000n);
  });

  it("decodes a denied payment log with its reason", () => {
    const log = buildPaymentAttemptLog({
      agent: "0x100000000000000000000000000000000000000A",
      to: "0x200000000000000000000000000000000000000b",
      amount: 500000000n,
      approved: false,
      reason: "amount exceeds dailyCap",
    });
    const result = parsePaymentAttempt([log]);
    expect(result?.approved).toBe(false);
    expect(result?.reason).toBe("amount exceeds dailyCap");
  });

  it("returns null when no PaymentAttempt log is present", () => {
    expect(parsePaymentAttempt([])).toBeNull();
  });
});
