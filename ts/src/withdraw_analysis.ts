import BN from "bn.js";
import { ServiceHelper, get_mongoose_db, get_contract_addr, get_image_md5, modelBundle, get_settle_private_account } from "./config.js";
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(get_mongoose_db(), {
});

async function analyzeWithdrawals() {
	try {
		const bundles = await modelBundle.find();

		let totalWithdrawals = 0;
		let uniqueAddresses = new Set();
		let totalAmount = BigInt(0);

		bundles.forEach(bundle => {
			if (bundle.withdrawArray && bundle.withdrawArray.length > 0) {
				totalWithdrawals += bundle.withdrawArray.length;

				bundle.withdrawArray.forEach(withdraw => {
					uniqueAddresses.add(withdraw.address);
					totalAmount += BigInt(withdraw.amount);
				});
			}
		});

		console.log(`Total Withdrawals: ${totalWithdrawals}`);
		console.log(`Unique Addresses: ${uniqueAddresses.size}`);
		console.log(`Total Amount Withdrawn: ${totalAmount.toString()}`); //In wei
	} catch (error) {
		console.error('Error analyzing withdrawals:', error);
	}
}

analyzeWithdrawals();
