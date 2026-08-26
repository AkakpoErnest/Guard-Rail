import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Only wire up real accounts for hskTestnet when a deployer key is actually
// provided. This keeps `hardhat compile` / `hardhat test` working with zero
// env setup (e.g. in CI or a fresh clone before a wallet is funded).
const AGENT_DEPLOYER_KEY = process.env.AGENT_DEPLOYER_KEY;
const hskAccounts = AGENT_DEPLOYER_KEY ? [AGENT_DEPLOYER_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // getPolicy() returns 7 values, which triggers "stack too deep"
      // under the legacy codegen pipeline; compiling via IR fixes it.
      viaIR: true,
    },
  },
  networks: {
    hskTestnet: {
      url: "https://testnet.hsk.xyz",
      chainId: 133,
      accounts: hskAccounts,
    },
  },
};

export default config;
