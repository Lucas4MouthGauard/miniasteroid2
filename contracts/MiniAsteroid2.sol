// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MiniAsteroid2 is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10 ** 18;

    constructor(address devWallet) ERC20("MiniAsteroid2", "MiniAsteroid2") {
        require(devWallet != address(0), "MiniAsteroid2: dev wallet is zero");
        _mint(devWallet, INITIAL_SUPPLY);
    }
}
