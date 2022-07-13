# Analysis of HalbornToken contract

## Table of Contents
1. [`root` variable of the contract is set but never used](#1-root-variable-of-the-contract-is-set-but-never-used)
2. [`mintTokensWithSignature` is vulnerable to replay attacks](#2-mintTokensWithSignature-is-vulnerable-to-replay-attacks)

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

## 2. `mintTokensWithSignature` is vulnerable to replay attacks
*Severity: High*
### Description
The `mintTokensWithSignature` function checks for the valid signature of the `signer` (set during the deployement of the contract) before minting tokens to the `msg.sender`.

As the signed message will contain the approved address designated for the mint, it effectively prevents anyone from replaying the message by calling from their own addresses.

However, the person controlling the approved address could eventually replay the message and mint additional tokens equal to the `amount` supplied in the signed message indefinitely. This will become a security issue if this address is compromised as their is no way to "disable" the original signed message.

In case the address is an EOA, it's also possible (though it requires extensive power, time and a bit of luck) for an attacker to deploy a smart contract at this address and trigger the replay attack for him/herself. 

### Code
```
function mintTokensWithSignature(uint256 amount, bytes32 _r, bytes32 _s, uint8 _v) public {
    bytes memory prefix = "\x19Ethereum Signed Message:\n32";
    bytes32 messageHash = keccak256(
        abi.encode(address(this), amount, msg.sender)
    );
    bytes32 hashToCheck = keccak256(abi.encodePacked(prefix, messageHash));
    require(signer == ecrecover(hashToCheck, _v, _r, _s), "Wrong signature");
    _mint(msg.sender, amount);
}
```

### Recommendations
**Immediate:**
- Add a `mapping(bytes32 => uint256)` to associate the signed message with the number of times the `mintTokensWithSignature` function is called.
- Add a `require` directive before calling the `_mint` function, only allowing for a certain number of calls to the function by the `msg.sender`.

**Future:**
- Ensure that the `signer` gives approval to trusted addresses, preferably multi-signatures wallets (like [Gnosis](https://gnosis-safe.io/)).
- Add a way for the `signer` to remove the minting right to previously approved addresses.
- Consider using proven and more secure alternatives for allowing minting roles such as [Access Control contracts](https://docs.openzeppelin.com/contracts/4.x/api/access).