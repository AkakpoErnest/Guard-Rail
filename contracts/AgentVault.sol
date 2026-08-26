// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentVault
/// @notice A spend-policy vault for AI agents. The owner deposits an ERC20
///         token (mUSDT on testnet) into the vault and grants agents narrow,
///         revocable spending policies: a per-transaction cap, a rolling
///         24h (UTC-day) cap, an address allowlist, and an expiry. Agents
///         call `agentPay` themselves to move funds within those limits.
///
/// @dev DESIGN DECISION - agentPay does NOT revert on policy denial.
///      -------------------------------------------------------------
///      The project brief asks for an onchain, queryable audit trail of
///      *every* payment attempt an agent makes, approved or denied ("emit an
///      event on every attempt"). Solidity events emitted during a
///      transaction that ultimately reverts are rolled back with the rest of
///      the transaction's state changes and never make it into a block, so a
///      "revert on violation" design would make denied attempts
///      unqueryable — defeating the audit-trail requirement.
///
///      Instead, `agentPay` treats a policy violation (inactive/revoked
///      policy, non-allowlisted recipient, over max-per-tx, over the daily
///      cap, or expired policy) as an ordinary, successfully-mined outcome:
///      it emits `PaymentAttempt(..., approved: false, reason: "...")` and
///      returns `false` without moving any funds. `agentPay` only reverts
///      for truly exceptional conditions that aren't part of the policy
///      surface — e.g. the underlying ERC20 transfer itself failing. This
///      keeps a full, permanent, UI-queryable history of what an agent
///      tried to do and why it was blocked. See also `contracts/README.md`.
contract AgentVault is Ownable {
    struct Policy {
        uint256 maxPerTx;
        uint256 dailyCap;
        uint256 expiry; // unix timestamp after which the policy is no longer usable
        bool active;
        uint256 dailySpent; // amount spent so far in `lastSpendDay`
        uint256 lastSpendDay; // UTC day index (block.timestamp / 1 days) of dailySpent
    }

    /// @notice The ERC20 token held and disbursed by this vault (mUSDT on testnet).
    IERC20 public token;

    mapping(address => Policy) private _policies;
    mapping(address => address[]) private _allowlistArray; // for UI/reads
    mapping(address => mapping(address => bool)) private _isAllowlisted;

    event PolicySet(
        address indexed agent,
        uint256 maxPerTx,
        uint256 dailyCap,
        address[] allowlist,
        uint256 expiry
    );
    event PolicyRevoked(address indexed agent);
    event TokenUpdated(address indexed token);

    /// @notice Emitted on every call to `agentPay`, whether approved or denied.
    event PaymentAttempt(
        address indexed agent,
        address indexed to,
        uint256 amount,
        bool approved,
        string reason
    );

    error ZeroAddress();

    constructor(address tokenAddress) Ownable(msg.sender) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        token = IERC20(tokenAddress);
    }

    /// @notice Owner-only: point the vault at a different ERC20 token.
    function setToken(address tokenAddress) external onlyOwner {
        if (tokenAddress == address(0)) revert ZeroAddress();
        token = IERC20(tokenAddress);
        emit TokenUpdated(tokenAddress);
    }

    /// @notice Owner-only: create or replace the spend policy for `agent`.
    /// @param agent The address (typically an AI agent's signer) being granted a policy.
    /// @param maxPerTx Maximum amount allowed in a single `agentPay` call.
    /// @param dailyCap Maximum cumulative amount allowed per UTC day.
    /// @param allowlist Addresses `agent` is permitted to pay.
    /// @param expiry Unix timestamp after which the policy stops working.
    function setPolicy(
        address agent,
        uint256 maxPerTx,
        uint256 dailyCap,
        address[] calldata allowlist,
        uint256 expiry
    ) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();

        // Clear any previous allowlist membership before writing the new one.
        address[] storage oldList = _allowlistArray[agent];
        for (uint256 i = 0; i < oldList.length; i++) {
            _isAllowlisted[agent][oldList[i]] = false;
        }
        delete _allowlistArray[agent];

        for (uint256 i = 0; i < allowlist.length; i++) {
            _isAllowlisted[agent][allowlist[i]] = true;
            _allowlistArray[agent].push(allowlist[i]);
        }

        Policy storage p = _policies[agent];
        p.maxPerTx = maxPerTx;
        p.dailyCap = dailyCap;
        p.expiry = expiry;
        p.active = true;
        // Intentionally leave dailySpent/lastSpendDay untouched so re-setting
        // a policy mid-day doesn't let an agent double-spend past the cap.

        emit PolicySet(agent, maxPerTx, dailyCap, allowlist, expiry);
    }

    /// @notice Owner-only: immediately deactivate `agent`'s policy.
    function revoke(address agent) external onlyOwner {
        _policies[agent].active = false;
        emit PolicyRevoked(agent);
    }

    /// @notice Called by an agent to spend from the vault under its policy.
    /// @dev See the contract-level NatSpec for why this does not revert on
    ///      policy denial. Returns true if the payment was approved and the
    ///      transfer succeeded, false if it was denied by policy.
    function agentPay(
        address to,
        uint256 amount,
        string calldata reason
    ) external returns (bool) {
        address agent = msg.sender;
        Policy storage p = _policies[agent];

        (bool ok, string memory denyReason) = _checkPolicy(p, agent, to, amount);

        if (!ok) {
            emit PaymentAttempt(agent, to, amount, false, denyReason);
            return false;
        }

        uint256 today = block.timestamp / 1 days;
        if (p.lastSpendDay != today) {
            p.lastSpendDay = today;
            p.dailySpent = 0;
        }
        p.dailySpent += amount;

        bool sent = token.transfer(to, amount);
        require(sent, "AgentVault: token transfer failed");

        emit PaymentAttempt(agent, to, amount, true, reason);
        return true;
    }

    /// @dev Pure policy evaluation, shared by agentPay and (optionally) offchain simulation.
    function _checkPolicy(
        Policy storage p,
        address agent,
        address to,
        uint256 amount
    ) internal view returns (bool ok, string memory reason) {
        if (!p.active) return (false, "policy inactive or revoked");
        if (block.timestamp > p.expiry) return (false, "policy expired");
        if (!_isAllowlisted[agent][to]) return (false, "recipient not allowlisted");
        if (amount > p.maxPerTx) return (false, "amount exceeds maxPerTx");

        uint256 today = block.timestamp / 1 days;
        uint256 spentToday = p.lastSpendDay == today ? p.dailySpent : 0;
        if (spentToday + amount > p.dailyCap) return (false, "amount exceeds dailyCap");

        return (true, "");
    }

    /// @notice Returns the policy fields for `agent`, for UI consumption.
    function getPolicy(
        address agent
    )
        external
        view
        returns (
            uint256 maxPerTx,
            uint256 dailyCap,
            uint256 expiry,
            bool active,
            uint256 dailySpent,
            uint256 lastSpendDay,
            address[] memory allowlist
        )
    {
        Policy storage p = _policies[agent];
        return (
            p.maxPerTx,
            p.dailyCap,
            p.expiry,
            p.active,
            p.dailySpent,
            p.lastSpendDay,
            _allowlistArray[agent]
        );
    }

    /// @notice Returns how much `agent` has spent so far in the current UTC day.
    function dailySpentToday(address agent) external view returns (uint256) {
        Policy storage p = _policies[agent];
        uint256 today = block.timestamp / 1 days;
        return p.lastSpendDay == today ? p.dailySpent : 0;
    }

    /// @notice Returns whether `to` is allowlisted for `agent`.
    function isAllowlisted(address agent, address to) external view returns (bool) {
        return _isAllowlisted[agent][to];
    }
}
