"use client";

import { useReadContracts } from "wagmi";
import { agentVaultAbi, mockUsdtAbi } from "./abi";
import { AGENT_VAULT_ADDRESS, AGENT_ADDRESS, MOCK_USDT_ADDRESS } from "./contracts";

/**
 * Reads the agent's policy, today's spend, and the vault's mUSDT balance in
 * one batch. Polls every 5s so the UI stays reasonably fresh without a
 * websocket subscription (see ReceiptFeed for the event-driven approach used
 * where staleness matters more).
 */
export function usePolicyData() {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      {
        address: AGENT_VAULT_ADDRESS,
        abi: agentVaultAbi,
        functionName: "getPolicy",
        args: [AGENT_ADDRESS],
      },
      {
        address: AGENT_VAULT_ADDRESS,
        abi: agentVaultAbi,
        functionName: "dailySpentToday",
        args: [AGENT_ADDRESS],
      },
      {
        address: MOCK_USDT_ADDRESS,
        abi: mockUsdtAbi,
        functionName: "balanceOf",
        args: [AGENT_VAULT_ADDRESS],
      },
    ],
    query: {
      refetchInterval: 5000,
    },
  });

  const policyResult = data?.[0];
  const dailySpentResult = data?.[1];
  const balanceResult = data?.[2];

  const policy =
    policyResult?.status === "success"
      ? {
          maxPerTx: policyResult.result[0],
          dailyCap: policyResult.result[1],
          expiry: policyResult.result[2],
          active: policyResult.result[3],
          dailySpent: policyResult.result[4],
          lastSpendDay: policyResult.result[5],
          allowlist: policyResult.result[6],
        }
      : undefined;

  const dailySpentToday =
    dailySpentResult?.status === "success" ? dailySpentResult.result : undefined;

  const vaultBalance =
    balanceResult?.status === "success" ? balanceResult.result : undefined;

  return { policy, dailySpentToday, vaultBalance, isLoading, refetch };
}
