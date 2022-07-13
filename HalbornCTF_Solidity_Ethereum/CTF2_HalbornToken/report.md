# Analysis of HalbornToken contract

## Table of Contents
1. [`root` variable of the contract is set but never used](#1-root-variable-of-the-contract-is-set-but-never-used)

## 1. `root` variable of the contract is set but never used
*Severity: Critical*
### Description
The `root` variable set in the constructor is constructed in a way similar to a [Merkle Tree root](https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/) to only allow certain addresses (presenting a valid proof) for minting tokens.

This is how the `mintTokensWithWhitelist` function is supposed to work. However, for unknown reasons, the function sends a user supplied `_root` parameter to the `verify` function, in charge of validating the `msg.sender` and proof(s) associated with it.

This means an attacker can send his own `_root` and `proof` to pass the validation function, resulting in the minting of an arbitrary amount of tokens for the attacker.

### Code
```
function mintTokensWithWhitelist(uint256 amount, bytes32 _root, bytes32[] memory _proof) public {
    bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
    require(verify(leaf, _root, _proof), "You are not whitelisted.");
    _mint(msg.sender, amount);
}
```

### Recommendations
**Immediate:** Remove the `_root` parameter in the `mintTokensWithWhitelist` function and pass the storage variable `root` to the `verify` function instead.

**Future:**
- Simplify the whitelisting process by providing directly a list of addresses to the constructor or to a function using the [Initializable](https://docs.openzeppelin.com/contracts/4.x/api/proxy#Initializable) modifier.
- Consider using proven and more secure alternatives for whitelisting users such as [Access Control contracts](https://docs.openzeppelin.com/contracts/4.x/api/access).