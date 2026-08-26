// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Mock USDT (mUSDT)
/// @notice TESTNET-ONLY mock ERC20 token used to demo Guardrail's spend-policy
///         vault. It mimics USDT's 6-decimal convention so amounts in the UI
///         and contracts line up with real USDT semantics.
/// @dev `mint` is intentionally public and unrestricted so anyone can top up
///      a demo wallet or the vault during a hackathon/testnet flow. This is
///      NOT safe for production -- a real deployment would use the real USDT
///      contract (or a properly access-controlled mock) instead.
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "mUSDT") {}

    /// @notice Mints `amount` of mUSDT to `to`. Anyone may call this.
    /// @dev Testnet-only faucet function -- never ship this to mainnet.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @dev USDT uses 6 decimals instead of the ERC20 default of 18.
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
