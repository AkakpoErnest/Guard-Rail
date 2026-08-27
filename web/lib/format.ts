import { formatUnits } from "viem";

// mUSDT (the demo token used by the vault) has 6 decimals — shared here so
// StatTiles, ChainStatePanel, and anything else formatting a token amount
// stay in sync instead of each hardcoding the literal.
export const MUSDT_DECIMALS = 6;

export const PLACEHOLDER = "—";

/** Formats a raw mUSDT amount (bigint, base units) for display, or a
 * placeholder dash while the value hasn't loaded yet. */
export function formatAmount(value: bigint | undefined): string {
  if (value === undefined) return PLACEHOLDER;
  return Number(formatUnits(value, MUSDT_DECIMALS)).toFixed(2);
}
