# Analysis of NFTMarketplace contract

## Table of Contents
1. [No validation that the poster of a sell order is the actual owner of the NFT](#1-No-validation-that-the-poster-of-a-sell-order-is-the-actual-owner-of-the-NFT)
2. [Overwriting of a sell order leads to exfiltration of the NFT](#2-Overwriting-of-a-sell-order-leads-to-exfiltration-of-the-NFT)
3. [Wrong check leads to siphoning of funds](#3-Wrong-check-leads-to-siphoning-of-funds)

## 1. No validation that the poster of a sell order is the actual owner of the NFT
### Description
When calling the `postSellOrder` function, the function only checks that the NFT id sent is valid but not that is belongs to the `msg.sender`. 

This allows anyone to post a sell order for any NFT id, even if a sell order has already been posted for that NFT since the contract associate only one NFT id to one sell order (`mapping(uint256 => Order) public sellOrder` line 89).

### Code
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

### Recommendations
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
### Description
As a consequence of [[1]](#1-No-validation-that-the-poster-of-a-sell-order-is-the-actual-owner-of-the-NFT), when calling the `postSellOrder` function the sell order for the `nftId` will be overwritten.

This allows the poster to then cancel the order through the `cancelSellOrder` function which doesn't check that the `msg.sender` is the owner of the NFT but only if it's the owner of the sell order. 

Hence, an attacker can steal any NFT approved to the marketplace.

### Code
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

### Recommendations
**Immediate:** Add a `require()` directive checking that the `msg.sender` is the actual owner of the NFT like the following:
```
require(
        HalbornNFTcollection.ownerOf(nftId) == msg.sender,
        "sender is not the owner of nftID"
    );
```
**Future:**
- Fixing [[1]](#1-No-validation-that-the-poster-of-a-sell-order-is-the-actual-owner-of-the-NFT) will fix this vulnerability as well.

## 3. Wrong check leads to siphoning of funds
### Description
The `cancelBuyOrder` and `decreaseBuyOrder` functions contains a logic bug when checking that only `Listed` orders can be modified.
```
require(
    order.status != OrderStatus.Cancelled ||
        order.status != OrderStatus.Fulfilled,
    "Order should be listed"
);
```
should be
```
require(
    order.status != OrderStatus.Cancelled &&
        order.status != OrderStatus.Fulfilled,
    "Order should be listed"
);
```
or simply
```
require(
    order.status == OrderStatus.Listed,
    "Order should be listed"
);
```

In `cancelBuyOrder`, this bug allows for an attacker to submit a buy order and cancel it indefinitely to get refunded.

This can also be achieved through the `decreaseBuyOrder` function that will transfer the tokens if the `decreaseAmount` provided is strictly less than the original buy order.

By posting new buy orders amounting to the current amount of stolen funds, an attacker can quickly empty all funds from the marketplace.

Note that this bug also affects the `increaseBuyOrder` function although no direct exploitation of the bug is possible in this case. 
### Code
```
function cancelBuyOrder(uint256 orderId) external nonReentrant {
    Order storage order = buyOrders[orderId];
    // cannot be a cancelled or fulfilled order
    require(
        order.status != OrderStatus.Cancelled ||
            order.status != OrderStatus.Fulfilled,
        "Order should be listed"
    );

    ...
}

function decreaseBuyOrder(uint256 orderId, uint256 decreaseAmount)
    external
    nonReentrant
{
    require(decreaseAmount > 0, "decreaseAmount > 0");
    Order storage order = buyOrders[orderId];
    require(
        order.amount > decreaseAmount,
        "order.amount > decreaseAmount"
    );
    // Can not be a cancelled or fulfilled order
    require(
        order.status != OrderStatus.Cancelled ||
            order.status != OrderStatus.Fulfilled,
        "Order should be listed"
    );

    ...
}

function increaseBuyOrder(uint256 orderId, uint256 increaseAmount)
    external
    nonReentrant
{
    require(increaseAmount > 0, "increaseAmount > 0");
    Order storage order = buyOrders[orderId];
    // cannot be a cancelled or fulfilled order
    require(
        order.status != OrderStatus.Cancelled ||
            order.status != OrderStatus.Fulfilled,
        "Order should be listed"
    );

    ...
}
```

### Recommendations
**Immediate:** Change the require check (line 209 to 213, line 240 to 244 and line 274 to 278) to the following:
```
require(
    order.status == OrderStatus.Listed,
    "Order should be listed"
);
```
**Future:**
- Carefully review the flow of execution and `require` statements of critical functions (handling funds, ownership, etc.).
- Consider using a [formal verification tool](https://github.com/leonardoalt/ethereum_formal_verification_overview#solidity) for asserting function's behavior before deploying smart contracts.