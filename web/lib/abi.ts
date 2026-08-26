// ABIs hand-derived from contracts/AgentVault.sol and contracts/MockUSDT.sol.
// Keep in sync with those source files if either changes.

export const agentVaultAbi = [
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "maxPerTx", type: "uint256" },
      { name: "dailyCap", type: "uint256" },
      { name: "allowlist", type: "address[]" },
      { name: "expiry", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revoke",
    stateMutability: "nonpayable",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "agentPay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getPolicy",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "maxPerTx", type: "uint256" },
      { name: "dailyCap", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "dailySpent", type: "uint256" },
      { name: "lastSpendDay", type: "uint256" },
      { name: "allowlist", type: "address[]" },
    ],
  },
  {
    type: "function",
    name: "dailySpentToday",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isAllowlisted",
    stateMutability: "view",
    inputs: [
      { name: "agent", type: "address" },
      { name: "to", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "PolicySet",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "maxPerTx", type: "uint256", indexed: false },
      { name: "dailyCap", type: "uint256", indexed: false },
      { name: "allowlist", type: "address[]", indexed: false },
      { name: "expiry", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PolicyRevoked",
    inputs: [{ name: "agent", type: "address", indexed: true }],
  },
  {
    type: "event",
    name: "PaymentAttempt",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "approved", type: "bool", indexed: false },
      { name: "reason", type: "string", indexed: false },
    ],
  },
] as const;

export const mockUsdtAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
