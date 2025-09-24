import BN from "bn.js";
import { ServiceHelper, get_mongoose_db, get_contract_addr, get_image_md5, get_settle_private_account } from "./config.js";
import { GlobalBundleService } from "./services/global-bundle-service.js";
import { decodeWithdraw } from "./convention.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(get_mongoose_db(), {
});

async function analyzeWithdrawals() {
	try {
		const globalBundleService = new GlobalBundleService();
		
		// Get all MD5s and analyze withdrawals for each
		const allMD5s = await globalBundleService.getAllUsedMD5s();
		console.log(`Found ${allMD5s.length} different MD5 versions`);
		
		let totalWithdrawals = 0;
		let uniqueAddresses = new Set();
		let totalAmount = BigInt(0);

		for (const md5 of allMD5s) {
			console.log(`\nAnalyzing withdrawals for MD5: ${md5}`);
			
			// Get all bundles for this MD5
			const bundles = await globalBundleService.getAllBundlesForMD5(md5);
			console.log(`Found ${bundles.length} bundles for this MD5`);
			
			bundles.forEach(bundle => {
				if (bundle.txdata && bundle.txdata.length > 0) {
					try {
						// Parse withdrawals from txdata - convert Buffer to Uint8Array
						const withdraws = decodeWithdraw(new Uint8Array(bundle.txdata));
						totalWithdrawals += withdraws.length;

						withdraws.forEach(withdraw => {
							uniqueAddresses.add(withdraw.address);
							totalAmount += withdraw.amount;
						});
					} catch (error) {
						console.warn(`Failed to parse txdata for bundle ${bundle.merkleRoot}:`, error);
					}
				}
			});
		}

		console.log(`\n=== Withdrawal Analysis Results ===`);
		console.log(`Total Withdrawals: ${totalWithdrawals}`);
		console.log(`Unique Addresses: ${uniqueAddresses.size}`);
		console.log(`Total Amount Withdrawn: ${totalAmount.toString()}`); //In wei
		
		await globalBundleService.close();
		
	} catch (error) {
		console.error('Error analyzing withdrawals:', error);
	}
}

analyzeWithdrawals();
