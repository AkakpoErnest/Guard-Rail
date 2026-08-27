"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { guardrailChain } from "@/lib/chain";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id";

const config = getDefaultConfig({
  appName: "Guardrail",
  projectId,
  chains: [guardrailChain],
  transports: {
    [guardrailChain.id]: http(),
  },
  ssr: true,
});

// Module-scope singleton is safe here specifically because `ssr: true`
// above makes wagmi's own hooks (useAccount, useReadContract, etc.) return
// a deterministic disconnected snapshot during server rendering, so no
// per-user data ever gets written into this cache on the server. That
// safety only holds as long as everything using this client is a
// wagmi-provided, wallet-address-gated hook — if a future addition puts a
// hand-rolled useQuery on this same client for something that resolves
// real per-user data during SSR, the usual cross-request cache-leak risk
// comes back and this should switch to a per-request QueryClient instead.
const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={guardrailChain}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
