import { ethers } from "hardhat";

/**
 * Deploys MockUSDT, then AgentVault pointed at it.
 *
 * NOTE: This script is written and ready but is NOT meant to be run yet —
 * there is no funded deployer wallet for HSK Testnet configured at the time
 * this was written. Once AGENT_DEPLOYER_KEY (see .env.example) is set and
 * funded, run:
 *
 *   npx hardhat run scripts/deploy.ts --network hskTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUsdt = await MockUSDT.deploy();
  await mockUsdt.waitForDeployment();
  const mockUsdtAddress = await mockUsdt.getAddress();
  console.log("MockUSDT deployed to:", mockUsdtAddress);

  const AgentVault = await ethers.getContractFactory("AgentVault");
  const vault = await AgentVault.deploy(mockUsdtAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("AgentVault deployed to:", vaultAddress);

  console.log("\nDeployment summary:");
  console.log("  MockUSDT:  ", mockUsdtAddress);
  console.log("  AgentVault:", vaultAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
