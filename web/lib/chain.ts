import { hashkeyTestnet } from "viem/chains";

// HashKey Chain Testnet — chain ID 133, RPC https://testnet.hsk.xyz.
// viem ships this chain definition built in; re-exported here so the rest
// of the app has one place to import it from.
export const guardrailChain = hashkeyTestnet;
