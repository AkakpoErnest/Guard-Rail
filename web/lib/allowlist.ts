import type { Address } from "viem";

export interface AllowlistEntry {
  label: string;
  address: Address;
}

// Demo allowlist. Recipient labels are frontend config, not onchain
// metadata (see docs/superpowers/specs/2026-08-26-guardrail-design.md,
// "Open items"). The addresses themselves ARE the onchain allowlist (set
// via setPolicy elsewhere); this file just maps friendly names to them for
// the chat agent and the UI.
export const ALLOWLIST_ENTRIES: AllowlistEntry[] = [
  {
    label: "Airtime vendor",
    address: "0x8a91C3B9a0D4F5E6C7A8B9D0E1F2A3B4C5D6E7F0",
  },
  {
    label: "Data bundle API",
    address: "0x2d70A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F1",
  },
];

export interface ResolvedRecipient {
  address: string;
  label?: string;
}

// A loose "looks like a hex address" check (0x + hex digits) used only as
// the final fallback, to decide whether unrecognized input should be
// echoed back as a raw address versus rejected as non-address text. This is
// deliberately more lenient than viem's `isAddress` (which requires exactly
// 40 hex chars plus valid EIP-55 checksum casing when strict): callers who
// need a hard validity guarantee on the resolved address should still run
// it through `isAddress` themselves before using it onchain.
const HEX_ADDRESS_PATTERN = /^0x[0-9a-fA-F]+$/;

/**
 * Resolves free-text (as it might appear in a chat message or a UI form) to
 * a recipient. Tries, in order: exact label match (case-insensitive), known
 * allowlist address match, then falls back to treating the input as a raw
 * address if it looks like one. Returns null if none apply.
 */
export function resolveRecipient(input: string): ResolvedRecipient | null {
  const trimmed = input.trim();

  const byLabel = ALLOWLIST_ENTRIES.find(
    (entry) => entry.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (byLabel) return { address: byLabel.address, label: byLabel.label };

  const byAddress = ALLOWLIST_ENTRIES.find(
    (entry) => entry.address.toLowerCase() === trimmed.toLowerCase()
  );
  if (byAddress) return { address: byAddress.address, label: byAddress.label };

  if (HEX_ADDRESS_PATTERN.test(trimmed)) return { address: trimmed };

  return null;
}
