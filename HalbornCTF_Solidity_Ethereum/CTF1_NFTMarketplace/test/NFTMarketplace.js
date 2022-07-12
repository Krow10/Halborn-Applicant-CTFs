const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[NFTMarketplace]', function() {
	before(async function() {
		[deployer, governance, attacker] = await ethers.getSigners();

		this.token = await (await ethers.getContractFactory('ApeCoin', deployer)).deploy();
		this.nfts = await (await ethers.getContractFactory('HalbornNFT', deployer)).deploy();
		this.marketplace = await (await ethers.getContractFactory('NFTMarketplace', deployer)).deploy(governance.address, this.token.address, this.nfts.address);
	});

	it('Test', async function() {

	});

	after(async function() {

	});
});