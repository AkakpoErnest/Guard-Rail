import { describe, it, expect } from "vitest";
import { resolveRecipient, ALLOWLIST_ENTRIES } from "./allowlist";

describe("resolveRecipient", () => {
  it("resolves a known label case-insensitively", () => {
    const entry = resolveRecipient("airtime vendor");
    expect(entry?.label).toBe("Airtime vendor");
    expect(entry?.address).toBe(ALLOWLIST_ENTRIES[0].address);
  });

  it("resolves a raw address that matches an entry", () => {
    const address = ALLOWLIST_ENTRIES[1].address;
    const entry = resolveRecipient(address);
    expect(entry?.label).toBe(ALLOWLIST_ENTRIES[1].label);
  });

  it("resolves an unrecognized address by returning it verbatim with no label", () => {
    const unknown = "0x00000000000000000000000000000000000000de";
    const entry = resolveRecipient(unknown);
    expect(entry?.address).toBe(unknown);
    expect(entry?.label).toBeUndefined();
  });

  it("returns null for text that isn't a label or an address", () => {
    expect(resolveRecipient("send it to the vibes")).toBeNull();
  });
});
