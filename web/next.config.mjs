/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { webpack }) => {
    // @coinbase/cdp-sdk (pulled in transitively via wagmi's connectors ->
    // @base-org/account -> @coinbase/cdp-sdk, for the Coinbase Smart
    // Wallet / Base Account connector that RainbowKit's getDefaultConfig
    // includes by default) statically imports the @x402/* packages even
    // though they're declared as optional peer dependencies. We don't use
    // x402 payments or the Base Account connector, and installing those
    // peers just to satisfy an unused static import isn't worth the
    // extra dependency surface — so tell webpack to skip resolving them.
    // If this starts failing again after a rainbowkit/wagmi version bump,
    // re-check the connector graph (wagmi connectors -> @base-org/account
    // -> @coinbase/cdp-sdk -> @x402/*) rather than assuming the regex
    // below still matches whatever changed.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@x402\//,
      })
    );
    // Two more well-known, benign optional-dependency warnings from
    // wagmi's connector stack (documented in RainbowKit's own Next.js
    // setup guide): MetaMask SDK's React Native storage backend, and
    // WalletConnect's pretty-printer for its pino logger. Neither is
    // used in a browser context.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
