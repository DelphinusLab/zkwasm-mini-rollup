import { ethers } from "ethers";
import { ServiceHelper, get_mongoose_db, get_contract_addr, get_image_md5, modelBundle, get_settle_private_account } from "./config.js";
import abiData from './Proxy.json' assert { type: 'json' };
import mongoose from 'mongoose';
import { PaginationResult, QueryParams, Task} from "zkwasm-service-helper";
import { U8ArrayUtil } from './lib.js';
import { decodeWithdraw} from "./convention.js";
import dotenv from 'dotenv';
import { provider, getMerkle } from "./contract.js";

dotenv.config();

const signer = new ethers.Wallet(get_settle_private_account(), provider);
//
const constants = {
  proxyAddress: get_contract_addr(),
};

mongoose.connect(get_mongoose_db(), {
    //useNewUrlParser: true,
    //useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {console.log("Connected to the database")});

async function getTask(taskid: string, d_state: string|null) {
  const queryParams: QueryParams = {
          id: taskid,
          tasktype: "Prove",
          taskstatus: d_state,
          user_address: null,
          md5: get_image_md5(),
          total: 1,
        };

  const response: PaginationResult<Task[]> = await ServiceHelper.loadTasks(
    queryParams
  );

  return response.data[0];
}

async function getTaskWithTimeout(taskId: string, timeout: number): Promise<any> {
 return Promise.race([getTask(taskId, "Done"), new Promise((_, reject) =>
     setTimeout(() => reject(new Error('load proof task Timeout exceeded')), timeout))
	]);
}

export async function getWithdrawEventParameters(
  proxy: ethers.Contract,
  receipt: ethers.ContractTransactionReceipt
): Promise<any[]> {
  let r: any[] = [];
  try {
    // Define the event signature
    const eventSignature = "event WithDraw(address l1token, address l1account, uint256 amount)";
    const iface = new ethers.Interface([eventSignature]);

    // Get the logs
    const logs = receipt.logs; // Assuming you have the logs from the receipt
    logs.forEach(log => {
      // Decode the log
      try {
        const decoded = iface.parseLog(log);
        if (decoded) {
          const l1token = decoded.args.l1token;
          const l1account = decoded.args.l1account;
	  const amount = decoded.args.amount; //in Wei
	  //console.log({ l1token, l1account, amount });
          r.push({
            token: l1token,
            address: l1account,
            amount: amount,
          });
        }
      } catch (error) {
        // Handle logs that don't match the event signature
        console.error("Log does not match event signature:", error);
      }
    });

  } catch (error) {
    console.error('Error retrieving withdraw event parameters:', error);
  }
  return r;
}


async function trySettle() {
  let merkleRoot = await getMerkle();
  console.log("typeof :", typeof(merkleRoot[0]));
  console.log(merkleRoot);
  try {
    let record = await modelBundle.findOne({ merkleRoot: merkleRoot});
    if (record) {
      let taskId = record.taskId;
      let data0 = await getTaskWithTimeout(taskId, 60000);

      //check failed or just timeout
      if (data0.proof.length == 0) {
        let data1 = await getTask(taskId, null);
	if (data1.status === "DryRunFailed" || data1.status === "Unprovable") {
	   console.log("Crash(Need manual review): task failed with state:", taskId, data1.status, data1.input_context);
	   while(1); //This is serious error, while loop to trigger manual review.
	   return -1;
	}  else {
	  console.log(`Task: ${taskId}, ${data1.status}, retry settle later.`); //will restart settle
	  return -1;
	}
      }
      let shadowInstances = data0.shadow_instances;
      let batchInstances = data0.batch_instances;

      let proofArr = new U8ArrayUtil(data0.proof).toNumber();
      let auxArr = new U8ArrayUtil(data0.aux).toNumber();
      let verifyInstancesArr =  shadowInstances.length === 0
        ? new U8ArrayUtil(batchInstances).toNumber()
        : new U8ArrayUtil(shadowInstances).toNumber();
      let instArr = new U8ArrayUtil(data0.instances).toNumber();
      console.log("txData_orig:", data0.input_context);
      let txData = new Uint8Array(data0.input_context);
      console.log("txData:", txData);
      console.log("txData.length:", txData.length);

      const proxy = new ethers.Contract(constants.proxyAddress, abiData.abi, signer);

      const tx = await proxy.verify(
        txData,
        proofArr,
        verifyInstancesArr,
        auxArr,
        [instArr],
      );
      // wait for tx to be mined, can add no. of confirmations as arg
      const receipt = await tx.wait();
      console.log("transaction:", tx.hash);
      console.log("receipt:", receipt);

      const r = decodeWithdraw(txData);
      const s = await getWithdrawEventParameters(proxy, receipt);
      const withdrawArray = [];
      let status = 'Done';
      if (r.length !== s.length) {
	  status = 'Fail';
          console.error("Arrays have different lengths,",r,s);
      } else {
          for (let i = 0; i < r.length; i++) {
              const rItem = r[i];
              const sItem = s[i];
              
              if (rItem.address !== sItem.address || rItem.amount !== sItem.amount) {
	          console.log("Crash(Need manual review):");
                  console.error(`Mismatch found: ${rItem.address}:${rItem.amount} ${sItem.address}:${sItem.amount}`);
		  while(1); //This is serious error, while loop to trigger manual review.
		  status = 'Fail';
		  break;
	      } else {
	      // Assuming rItem is defined and has address and amount
	      record.withdrawArray.push({
	         address: rItem.address,
	         amount: rItem.amount,
	      });
	      }
          }
      }
      //update record
      record.settleTxHash = tx.hash;
      record.settleStatus = status;
      await record.save();
      console.log("Receipt verified");
    } else {
      console.log(`proof bundle ${merkleRoot} not found`);
    }
  } catch(e) {
    console.log("Exception happen in trySettle()");
    console.log(e);
  }
}

// start monitoring and settle
async function main() {
 while (true) {
        try {
            await trySettle();
        } catch (error) {
            console.error("Error during trySettle:", error);
        }
     await new Promise(resolve => setTimeout(resolve, 60000));
 }
}

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log("Running settle.js directly");
    main().catch(console.error);
} else {
    console.log("settle.js is being imported as a module");
}
