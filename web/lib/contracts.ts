import type { Address } from "viem";

function requireEnv(name: string, value: string | undefined): Address {
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value as Address;
}

export const AGENT_VAULT_ADDRESS = requireEnv(
  "NEXT_PUBLIC_AGENT_VAULT_ADDRESS",
  process.env.NEXT_PUBLIC_AGENT_VAULT_ADDRESS
);

export const MOCK_USDT_ADDRESS = requireEnv(
  "NEXT_PUBLIC_MOCK_USDT_ADDRESS",
  process.env.NEXT_PUBLIC_MOCK_USDT_ADDRESS
);

export const AGENT_ADDRESS = requireEnv(
  "NEXT_PUBLIC_AGENT_ADDRESS",
  process.env.NEXT_PUBLIC_AGENT_ADDRESS
);
