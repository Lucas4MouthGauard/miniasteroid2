// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AsteroidClaimDistributor is EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address account,uint256 cumulativeAmount,uint256 deadline)");

    IERC20 public immutable token;
    address public immutable signer;

    mapping(address => uint256) public claimed;

    event Claimed(address indexed account, uint256 amount, uint256 cumulativeAmount);

    error InvalidAddress();
    error SignatureExpired();
    error InvalidSignature();
    error NothingToClaim();

    constructor(address tokenAddress, address signerAddress)
        EIP712("AsteroidClaimDistributor", "1")
    {
        if (tokenAddress == address(0) || signerAddress == address(0)) {
            revert InvalidAddress();
        }

        token = IERC20(tokenAddress);
        signer = signerAddress;
    }

    function claim(uint256 cumulativeAmount, uint256 deadline, bytes calldata signature) external {
        if (block.timestamp > deadline) {
            revert SignatureExpired();
        }

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_TYPEHASH, msg.sender, cumulativeAmount, deadline))
        );

        if (ECDSA.recover(digest, signature) != signer) {
            revert InvalidSignature();
        }

        uint256 alreadyClaimed = claimed[msg.sender];
        if (cumulativeAmount <= alreadyClaimed) {
            revert NothingToClaim();
        }

        uint256 payoutAmount = cumulativeAmount - alreadyClaimed;
        claimed[msg.sender] = cumulativeAmount;
        token.safeTransfer(msg.sender, payoutAmount);

        emit Claimed(msg.sender, payoutAmount, cumulativeAmount);
    }
}
