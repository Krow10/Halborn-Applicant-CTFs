# Analysis of NFTMarketplace contract

## 1. No validation that the poster of a sell order is the actual owner of the NFT
#### Description
When calling the `postSellOrder` function, the function only checks that the NFT id sent is valid but not that is belongs to the `msg.sender`. 

This allows anyone to post a sell order for any NFT id, even if a sell order has already been posted for that NFT since the contract associate only one NFT id to one sell order (`mapping(uint256 => Order) public sellOrder` line 89).

#### Code
```
function postSellOrder(uint256 nftId, uint256 amount)
    external
    nonReentrant
{
    require(amount > 0, "amount > 0");
    // require existence of the nftId
    require(
        HalbornNFTcollection.ownerOf(nftId) != address(0),
        "nftID does not exists"
    );
    // overrides the current sellOrder
    Order storage order = sellOrder[nftId];
    order.owner = _msgSender();
    order.status = OrderStatus.Listed;
    order.amount = amount;
    order.nftId = nftId;
    // take the 721 as collateral
    HalbornNFTcollection.safeTransferFrom(
        HalbornNFTcollection.ownerOf(nftId),
        address(this),
        nftId,
        bytes("COLLATERAL")
    );
    
    ...
}
```

#### Recommendations
**Immediate:** Add a `require()` directive checking that the `msg.sender` is the actual owner of the NFT like the following:
```
require(
        HalbornNFTcollection.ownerOf(nftId) == msg.sender,
        "sender is not the owner of nftID"
    );
```
**Future:**
- Consider using an approval system for posting selling orders *or* validating buy orders that would require an additional step from the owner before sending the NFT.

## 2. Overwriting of a sell order leads to exfiltration of the NFT
#### Description
As a consequence of [1.](#1-No-validation-that-the-poster-of-a-sell-order-is-the-actual-owner-of-the-NFT), when calling the `postSellOrder` function the sell order for the `nftId` will be overwritten.

This allows the poster to then cancel the order through the `cancelSellOrder` function which doesn't check that the `msg.sender` is the owner of the NFT but only if it's the owner of the sell order. 

Hence, an attacker can steal any NFT listed on the marketplace.

#### Code
```
function cancelSellOrder(uint256 nftId) external nonReentrant {
    Order storage order = sellOrder[nftId];
    // cannot be a cancelled or fulfilled order
    require(
        order.status != OrderStatus.Cancelled ||
            order.status != OrderStatus.Fulfilled,
        "Order should be listed"
    );
    // simply change status of order to cancelled
    require(
        _msgSender() == order.owner,
        "Order ownership"
    );
    // return the ERC721 NFT to the owner
    HalbornNFTcollection.safeTransferFrom(
        address(this),
        _msgSender(),
        nftId,
        bytes("RETURNING COLLATERAL")
    );

    ...
}
```

#### Recommendations
**Immediate:** Add a `require()` directive checking that the `msg.sender` is the actual owner of the NFT like the following:
```
require(
        HalbornNFTcollection.ownerOf(nftId) == msg.sender,
        "sender is not the owner of nftID"
    );
```
**Future:**
- Fixing [1.](#1-No-validation-that-the-poster-of-a-sell-order-is-the-actual-owner-of-the-NFT) will fix this vulnerability as well.

## 3.
#### Description

#### Code

#### Recommendations
**Immediate:**

**Future:**
- 