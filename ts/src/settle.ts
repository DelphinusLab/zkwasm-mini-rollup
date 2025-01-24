import { ethers } from "ethers";
import { ServiceHelper, get_mongoose_db, get_contract_addr, get_image_md5, modelBundle, get_settle_private_account, get_chain_id } from "./config.js";
import abiData from './Proxy.json' assert { type: 'json' };
import mongoose from 'mongoose';
import { ZkWasmUtil, PaginationResult, QueryParams, Task, VerifyProofParams, AutoSubmitStatus, Round1Status, Round1Info } from "zkwasm-service-helper";
import { U8ArrayUtil } from './lib.js';
import { submitRawProof} from "./prover.js";
import { decodeWithdraw} from "./convention.js";
import dotenv from 'dotenv';
import { provider, getMerkle } from "./contract.js";

dotenv.config();

const signer = new ethers.Wallet(get_settle_private_account(), provider);
//
const constants = {
  proxyAddress: get_contract_addr(),
  chainId: get_chain_id(),
};

function convertToBigUint64Array(combinedRoot: bigint): BigUint64Array {
  const result = new BigUint64Array(4);

  for (let i = 3; i >= 0; i--) {
    result[i] = combinedRoot & BigInt(2n ** 64n - 1n);
    combinedRoot = combinedRoot >> 64n;
  }

  return result;
}

export async function getMerkleArray(): Promise<BigUint64Array>{
  // Connect to the Proxy contract
  const proxy = new ethers.Contract(constants.proxyAddress, abiData.abi, provider);
  // Fetch the proxy information
  let proxyInfo = await proxy.getProxyInfo();
  console.log("Proxy Info:", proxyInfo);
  // Extract the old Merkle root
  const oldRoot = proxyInfo.merkle_root;
  console.log("Type of oldRoot:", typeof oldRoot);
  console.log("Old Merkle Root:", oldRoot);
  console.log("Settle:Old Merkle Root in u64:",convertToBigUint64Array(oldRoot));

  return convertToBigUint64Array(oldRoot);
}

mongoose.connect(get_mongoose_db(), {
    //useNewUrlParser: true,
    //useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {console.log("Connected to the database")});

async function getTask(taskid: string, d_state: string|null): Promise<Task> {
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

async function getTaskWithTimeout(taskId: string, timeout: number): Promise<Task | null> {
  return Promise.race([
    getTask(taskId, "Done"),
    new Promise(
      (resolve:(v:null)=>void, reject) => setTimeout(
        () => reject(new Error('load proof task Timeout exceeded')), timeout
      )
    )
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

/* We encode all params in string format of BN */
interface ProofArgs {
  txData: Uint8Array,
  proofArr: Array<string>,
  verifyInstanceArr: Array<string>,
  auxArr: Array<string>,
  instArr: Array<string>,
}

async function prepareVerifyAttributesSingle(task: Task): Promise<ProofArgs> {
  let shadowInstances = task.shadow_instances;
  let batchInstances = task.batch_instances;

  let proofArr = new U8ArrayUtil(task.proof).toNumber();
  let auxArr = new U8ArrayUtil(task.aux).toNumber();
  let verifyInstancesArr =  shadowInstances.length === 0
    ? new U8ArrayUtil(batchInstances).toNumber()
    : new U8ArrayUtil(shadowInstances).toNumber();
  let instArr = new U8ArrayUtil(task.instances).toNumber();
  console.log("txData_orig:", task.input_context);
  let txData = new Uint8Array(task.input_context);
  console.log("txData:", txData);
  console.log("txData.length:", txData.length);
  return {
    txData: txData,
    proofArr: proofArr,
    verifyInstanceArr: verifyInstancesArr,
    auxArr: auxArr,
    instArr: instArr,
  }
}

async function prepareVerifyAttributesBatch(task: Task): Promise<ProofArgs> {
  let txData = new Uint8Array(task.input_context);
  const round_1_info_response = await ServiceHelper.queryRound1Info({
    task_id: task._id.$oid,
    chain_id: Number(constants.chainId),
    status: Round1Status.Batched,
    total: 1,
  });

  let shadowInstances = task.shadow_instances;
  let batchInstances = task.batch_instances;

  const round_1_output: Round1Info = round_1_info_response.data[0];

  let verifyInstancesArr =  shadowInstances.length === 0
    ? new U8ArrayUtil(batchInstances).toNumber()
    : new U8ArrayUtil(shadowInstances).toNumber();

  const siblingInstances = new U8ArrayUtil(new Uint8Array(round_1_output.target_instances[0])).toNumber();
  const r1ShadowInstance = new U8ArrayUtil(new Uint8Array(round_1_output.shadow_instances!)).toNumber()[0];

  let instArr = new U8ArrayUtil(task.instances).toNumber();

  // Find the index of this proof in the round 1 output by comparing task_ids
  // This will be used to verify that this proof was included in a particular batch.
  // If it does not exist, the verification will fail
  const index = round_1_output.task_ids.findIndex(
    (id:any) => id === task._id["$oid"]
  );

  let proofArr = siblingInstances;
  proofArr.push(r1ShadowInstance);

  return {
    txData: txData,
    proofArr: proofArr,
    verifyInstanceArr: verifyInstancesArr,
    auxArr: [index.toString()],
    instArr: instArr,
  }
}

async function prepareVerifyAttributes(task: Task): Promise<ProofArgs> {
  if(task.proof_submit_mode == "Manual") {
    return await prepareVerifyAttributesSingle(task);
  } else {
    return await prepareVerifyAttributesBatch(task);
  }
}

async function trySettle() {
  let merkleRoot = await getMerkle();
  console.log("typeof :", typeof(merkleRoot[0]));
  console.log(merkleRoot);
  const proxy = new ethers.Contract(constants.proxyAddress, abiData.abi, signer);

  try {
    let record = await modelBundle.findOne({ merkleRoot: merkleRoot});
    if (record) {
      let taskId = record.taskId;
      let task = await getTaskWithTimeout(taskId, 60000);
      if (task!.proof_submit_mode == "Auto") {
        const isRegistered =
          task!.auto_submit_status === AutoSubmitStatus.RegisteredProof;

        if (!isRegistered) {
          console.log("waiting for proof to be registered ... ");
          return -1;
        }
      }

      let attributes = await prepareVerifyAttributesSingle(task!);

      const tx = await proxy.verify(
        attributes.txData,
        attributes.proofArr,
        attributes.verifyInstanceArr,
        attributes.auxArr,
        [attributes.instArr],
      );
      // wait for tx to be mined, can add no. of confirmations as arg
      const receipt = await tx.wait();
      console.log("transaction:", tx.hash);
      console.log("receipt:", receipt);

      const r = decodeWithdraw(attributes.txData);
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

async function setup() {
  console.log("Running setup...");
  
  try {
    // Get task info from environment variable
    const taskId = process.env.TASK_ID;
    if (!taskId) {
      throw new Error("TASK_ID environment variable is required for setup");
    }

    // Get task details
    const task = await getTaskWithTimeout(taskId, 60000);
    if (!task) {
      throw new Error("Failed to fetch task information");
    }

    // Connect to contract
    const proxy = new ethers.Contract(constants.proxyAddress, abiData.abi, signer);

    // Get instances array and convert to numbers
    const instances = new U8ArrayUtil(task.instances).toNumber();
    
    // Calculate merkle root from instances array (matching contract format)
    // instances[0-3] represent the old root in 64-bit chunks
    const merkleRoot = (BigInt(instances[0]) << 192n) +
                      (BigInt(instances[1]) << 128n) +
                      (BigInt(instances[2]) << 64n) +
                      BigInt(instances[3]);
    
    console.log("Setting merkle root:", merkleRoot.toString());
    await proxy.setMerkle(merkleRoot);

    // Get verify instances array
    const verifyInstances = task.shadow_instances.length === 0
      ? new U8ArrayUtil(task.batch_instances).toNumber()
      : new U8ArrayUtil(task.shadow_instances).toNumber();

    // Image commitments are in verify_instance[1-3]
    if (verifyInstances.length >= 4) {
      console.log("Setting verifier image commitments:", [
        verifyInstances[1],
        verifyInstances[2],
        verifyInstances[3]
      ]);
      
      await proxy.setVerifierImageCommitments([
        verifyInstances[1],
        verifyInstances[2],
        verifyInstances[3]
      ]);
    } else {
      console.warn("Verify instances array too short for image commitments");
    }

    console.log("Setup completed successfully");
  } catch (error) {
    console.error("Setup failed:", error);
    throw error;
  }
}

// Modify main function to conditionally run setup
async function main() {
  if (process.env.SETUP) {
    console.log("Running contract setup...");
    await setup();
  }
  
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
