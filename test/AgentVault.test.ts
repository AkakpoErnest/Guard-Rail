import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { AgentVault, MockUSDT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const DAY = 24 * 60 * 60;

describe("AgentVault", function () {
  async function deployFixture() {
    const [owner, agent, allowedTo, otherTo, stranger] = await ethers.getSigners();

    const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
    const usdt = (await MockUSDTFactory.deploy()) as unknown as MockUSDT;
    await usdt.waitForDeployment();

    const AgentVaultFactory = await ethers.getContractFactory("AgentVault");
    const vault = (await AgentVaultFactory.deploy(
      await usdt.getAddress()
    )) as unknown as AgentVault;
    await vault.waitForDeployment();

    // Fund the vault with 1,000 mUSDT (6 decimals).
    const vaultFunding = ethers.parseUnits("1000", 6);
    await usdt.mint(await vault.getAddress(), vaultFunding);

    const maxPerTx = ethers.parseUnits("100", 6);
    const dailyCap = ethers.parseUnits("150", 6);
    const farExpiry = (await time.latest()) + 30 * DAY;

    return {
      owner,
      agent,
      allowedTo,
      otherTo,
      stranger,
      usdt,
      vault,
      maxPerTx,
      dailyCap,
      farExpiry,
    };
  }

  async function setStandardPolicy(
    vault: AgentVault,
    owner: HardhatEthersSigner,
    agent: HardhatEthersSigner,
    allowedTo: HardhatEthersSigner,
    maxPerTx: bigint,
    dailyCap: bigint,
    expiry: number
  ) {
    await vault
      .connect(owner)
      .setPolicy(agent.address, maxPerTx, dailyCap, [allowedTo.address], expiry);
  }

  it("allows a payment within policy and transfers tokens", async function () {
    const { owner, agent, allowedTo, usdt, vault, maxPerTx, dailyCap, farExpiry } =
      await loadFixture(deployFixture);

    await setStandardPolicy(vault, owner, agent, allowedTo, maxPerTx, dailyCap, farExpiry);

    const amount = ethers.parseUnits("50", 6);
    const balBefore = await usdt.balanceOf(allowedTo.address);

    const tx = await vault.connect(agent).agentPay(allowedTo.address, amount, "invoice #1");
    await expect(tx)
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, amount, true, "invoice #1");

    const balAfter = await usdt.balanceOf(allowedTo.address);
    expect(balAfter - balBefore).to.equal(amount);
    expect(await vault.dailySpentToday(agent.address)).to.equal(amount);
  });

  it("denies a payment over maxPerTx (event emitted, no transfer)", async function () {
    const { owner, agent, allowedTo, usdt, vault, maxPerTx, dailyCap, farExpiry } =
      await loadFixture(deployFixture);

    await setStandardPolicy(vault, owner, agent, allowedTo, maxPerTx, dailyCap, farExpiry);

    const amount = maxPerTx + 1n;
    const balBefore = await usdt.balanceOf(allowedTo.address);

    const tx = await vault.connect(agent).agentPay(allowedTo.address, amount, "too big");
    await expect(tx)
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, amount, false, "amount exceeds maxPerTx");

    expect(await usdt.balanceOf(allowedTo.address)).to.equal(balBefore);
    expect(await vault.dailySpentToday(agent.address)).to.equal(0);
  });

  it("denies a payment over dailyCap", async function () {
    const { owner, agent, allowedTo, usdt, vault, maxPerTx, dailyCap, farExpiry } =
      await loadFixture(deployFixture);

    await setStandardPolicy(vault, owner, agent, allowedTo, maxPerTx, dailyCap, farExpiry);

    // dailyCap is 150, maxPerTx is 100. First spend 100 (allowed, under both
    // caps), then attempt another 60 -> cumulative 160 > 150 dailyCap, denied.
    const firstAmount = ethers.parseUnits("100", 6);
    await vault.connect(agent).agentPay(allowedTo.address, firstAmount, "first");

    const balBefore = await usdt.balanceOf(allowedTo.address);
    const secondAmount = ethers.parseUnits("60", 6);
    const tx = await vault.connect(agent).agentPay(allowedTo.address, secondAmount, "second");
    await expect(tx)
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, secondAmount, false, "amount exceeds dailyCap");

    expect(await usdt.balanceOf(allowedTo.address)).to.equal(balBefore);
    expect(await vault.dailySpentToday(agent.address)).to.equal(firstAmount);
  });

  it("denies a payment to a non-allowlisted address", async function () {
    const { owner, agent, allowedTo, otherTo, usdt, vault, maxPerTx, dailyCap, farExpiry } =
      await loadFixture(deployFixture);

    await setStandardPolicy(vault, owner, agent, allowedTo, maxPerTx, dailyCap, farExpiry);

    const amount = ethers.parseUnits("10", 6);
    const balBefore = await usdt.balanceOf(otherTo.address);

    const tx = await vault.connect(agent).agentPay(otherTo.address, amount, "not allowed");
    await expect(tx)
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, otherTo.address, amount, false, "recipient not allowlisted");

    expect(await usdt.balanceOf(otherTo.address)).to.equal(balBefore);
  });

  it("denies a payment after the policy has been revoked", async function () {
    const { owner, agent, allowedTo, usdt, vault, maxPerTx, dailyCap, farExpiry } =
      await loadFixture(deployFixture);

    await setStandardPolicy(vault, owner, agent, allowedTo, maxPerTx, dailyCap, farExpiry);
    await vault.connect(owner).revoke(agent.address);

    const amount = ethers.parseUnits("10", 6);
    const balBefore = await usdt.balanceOf(allowedTo.address);

    const tx = await vault.connect(agent).agentPay(allowedTo.address, amount, "post revoke");
    await expect(tx)
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, amount, false, "policy inactive or revoked");

    expect(await usdt.balanceOf(allowedTo.address)).to.equal(balBefore);
  });

  it("denies a payment after the policy has expired", async function () {
    const { owner, agent, allowedTo, usdt, vault, maxPerTx, dailyCap } =
      await loadFixture(deployFixture);

    const nearExpiry = (await time.latest()) + 60; // expires in 60s
    await setStandardPolicy(vault, owner, agent, allowedTo, maxPerTx, dailyCap, nearExpiry);

    await time.increase(120); // move past expiry

    const amount = ethers.parseUnits("10", 6);
    const balBefore = await usdt.balanceOf(allowedTo.address);

    const tx = await vault.connect(agent).agentPay(allowedTo.address, amount, "post expiry");
    await expect(tx)
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, amount, false, "policy expired");

    expect(await usdt.balanceOf(allowedTo.address)).to.equal(balBefore);
  });

  it("accumulates two payments in one day against the dailyCap", async function () {
    const { owner, agent, allowedTo, usdt, vault, maxPerTx, dailyCap, farExpiry } =
      await loadFixture(deployFixture);

    await setStandardPolicy(vault, owner, agent, allowedTo, maxPerTx, dailyCap, farExpiry);

    const first = ethers.parseUnits("90", 6);
    const second = ethers.parseUnits("60", 6); // 90 + 60 = 150 == dailyCap, should still succeed

    await expect(vault.connect(agent).agentPay(allowedTo.address, first, "a"))
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, first, true, "a");

    await expect(vault.connect(agent).agentPay(allowedTo.address, second, "b"))
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, second, true, "b");

    expect(await vault.dailySpentToday(agent.address)).to.equal(first + second);
    expect(await usdt.balanceOf(allowedTo.address)).to.equal(first + second);

    // A third payment that would push past the cap should now be denied.
    const third = ethers.parseUnits("1", 6);
    await expect(vault.connect(agent).agentPay(allowedTo.address, third, "c"))
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, third, false, "amount exceeds dailyCap");
  });

  it("resets dailySpent when a new UTC day starts", async function () {
    const { owner, agent, allowedTo, usdt, vault, maxPerTx, dailyCap, farExpiry } =
      await loadFixture(deployFixture);

    await setStandardPolicy(vault, owner, agent, allowedTo, maxPerTx, dailyCap, farExpiry);

    const amount = ethers.parseUnits("100", 6); // == maxPerTx, < dailyCap
    await vault.connect(agent).agentPay(allowedTo.address, amount, "day1-a");
    expect(await vault.dailySpentToday(agent.address)).to.equal(amount);

    // A second payment the same day would exceed the 150 dailyCap (100+100=200).
    await expect(vault.connect(agent).agentPay(allowedTo.address, amount, "day1-b"))
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, amount, false, "amount exceeds dailyCap");

    // Move exactly one full day forward -> new UTC day index, dailySpent resets.
    await time.increase(DAY);

    const balBefore = await usdt.balanceOf(allowedTo.address);
    const tx = await vault.connect(agent).agentPay(allowedTo.address, amount, "day2-a");
    await expect(tx)
      .to.emit(vault, "PaymentAttempt")
      .withArgs(agent.address, allowedTo.address, amount, true, "day2-a");

    expect(await usdt.balanceOf(allowedTo.address)).to.equal(balBefore + amount);
    expect(await vault.dailySpentToday(agent.address)).to.equal(amount);
  });

  it("only the owner can set or revoke a policy", async function () {
    const { agent, allowedTo, stranger, vault, maxPerTx, dailyCap, farExpiry } =
      await loadFixture(deployFixture);

    await expect(
      vault
        .connect(stranger)
        .setPolicy(agent.address, maxPerTx, dailyCap, [allowedTo.address], farExpiry)
    ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

    await expect(vault.connect(stranger).revoke(agent.address)).to.be.revertedWithCustomError(
      vault,
      "OwnableUnauthorizedAccount"
    );
  });

  it("denies agentPay from an address with no policy at all", async function () {
    const { allowedTo, stranger, vault } = await loadFixture(deployFixture);

    const amount = ethers.parseUnits("1", 6);
    const tx = await vault.connect(stranger).agentPay(allowedTo.address, amount, "no policy");
    await expect(tx)
      .to.emit(vault, "PaymentAttempt")
      .withArgs(stranger.address, allowedTo.address, amount, false, "policy inactive or revoked");
  });
});
