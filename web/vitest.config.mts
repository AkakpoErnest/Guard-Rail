import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// lib/contracts.ts reads NEXT_PUBLIC_* env vars from process.env at module
// load time (the same way Next.js does), so tests that import anything
// which pulls in lib/contracts.ts need those vars populated too. Next.js
// loads .env.local itself; standalone vitest doesn't, so load it here via
// Vite's built-in env loader and copy it onto process.env.
const env = loadEnv("", process.cwd(), "");
for (const [key, value] of Object.entries(env)) {
  process.env[key] ??= value;
}

// Next.js's webpack build aliases the "server-only" package to a no-op when
// bundling server code (and to a throwing stub when bundling client code),
// which is how modules like lib/agentWallet.ts can safely `import
// "server-only"` as a guard. Vitest doesn't go through that build, so it
// resolves the real package and hits its throw unconditionally. Alias it to
// a no-op here too, mirroring Next's server-side behavior for tests.
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(dirname, "./test/server-only-stub.ts"),
    },
  },
});
