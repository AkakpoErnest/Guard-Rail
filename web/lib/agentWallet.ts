import "server-only";
import {
  createWalletClient,
  createPublicClient,
  http,
  decodeEventLog,
  type Log,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { guardrailChain } from "./chain";
import { agentVaultAbi } from "./abi";
import { AGENT_VAULT_ADDRESS } from "./contracts";

function getAgentAccount() {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) throw new Error("Missing AGENT_PRIVATE_KEY env var");
  return privateKeyToAccount(key as `0x${string}`);
}

const publicClient = createPublicClient({
  chain: guardrailChain,
  transport: http(),
});

function getWalletClient() {
  return createWalletClient({
    account: getAgentAccount(),
    chain: guardrailChain,
    transport: http(),
  });
}

export interface PaymentOutcome {
  approved: boolean;
  amount: bigint;
  reason: string;
  txHash: Hash;
}

/**
 * Scans a transaction's logs for AgentVault's PaymentAttempt event and
 * decodes it. AgentVault.agentPay never reverts on a policy denial (see
 * contracts/AgentVault.sol NatSpec), so this event — not tx success — is the
 * source of truth for whether a payment was actually approved.
 */
export function parsePaymentAttempt(
  logs: readonly Log[]
): { approved: boolean; amount: bigint; reason: string } | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: agentVaultAbi,
        eventName: "PaymentAttempt",
        topics: log.topics,
        data: log.data,
      });
      return {
        approved: decoded.args.approved,
        amount: decoded.args.amount,
        reason: decoded.args.reason,
      };
    } catch {
      // Not a PaymentAttempt log (or from a different event) — skip it.
      continue;
    }
  }
  return null;
}

/**
 * Signs and submits agentPay(to, amount, reason) using the server-held agent
 * wallet, waits for the receipt, and returns the real approved/denied
 * outcome decoded from the PaymentAttempt event.
 */
export async function payViaAgent(
  to: `0x${string}`,
  amount: bigint,
  reason: string
): Promise<PaymentOutcome> {
  const walletClient = getWalletClient();
  const txHash = await walletClient.writeContract({
    address: AGENT_VAULT_ADDRESS,
    abi: agentVaultAbi,
    functionName: "agentPay",
    args: [to, amount, reason],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const outcome = parsePaymentAttempt(receipt.logs);

  if (!outcome) {
    throw new Error(
      `agentPay transaction ${txHash} mined but emitted no PaymentAttempt event`
    );
  }

  return { ...outcome, txHash };
}
