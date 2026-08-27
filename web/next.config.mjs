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
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@x402\//,
      })
    );
    return config;
  },
};

export default nextConfig;
