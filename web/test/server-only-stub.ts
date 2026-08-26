// Test-only stand-in for the "server-only" package (see vitest.config.ts).
// Intentionally empty: Next.js's webpack build treats "server-only" as a
// no-op when bundling server code, and this mirrors that for tests run
// outside of Next's bundler.
export {};
