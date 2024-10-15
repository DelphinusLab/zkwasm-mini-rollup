import BN from "bn.js";
import { ethers } from "ethers";
import { ServiceHelper, get_mongoose_db, get_contract_addr, get_image_md5, modelBundle, get_settle_private_account } from "./config.js";
import abiData from './Proxy.json' assert { type: 'json' };
import mongoose from 'mongoose';
import {ZkWasmUtil, PaginationResult, QueryParams, Task, VerifyProofParams} from "zkwasm-service-helper";
import { U8ArrayUtil, NumberUtil } from './lib.js';
import dotenv from 'dotenv';

dotenv.config();

let provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
if (process.env.RPC_PROVIDER) {
 provider = new ethers.JsonRpcProvider(process.env.RPC_PROVIDER);
}

const signer = new ethers.Wallet(get_settle_private_account(), provider);
//
const constants = {
  proxyAddress: get_contract_addr(),
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

async function getMerkle(): Promise<String>{
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

  let bnStr = oldRoot.toString(10);
  let bn = new BN(bnStr, 10);
  let oldRootBeString = '0x' + bn.toString("hex", 64);

  console.log("Old Merkle Root(string):", oldRootBeString);
  return oldRootBeString;
}

mongoose.connect(get_mongoose_db(), {
    //useNewUrlParser: true,
    //useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {console.log("Connected to the database")});

async function getTask(taskid: string) {
  const queryParams: QueryParams = {
          id: taskid,
          tasktype: "Prove",
          taskstatus: "Done",
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
 return Promise.race([getTask(taskId), new Promise((_, reject) =>
     setTimeout(() => reject(new Error('load proof task Timeout exceeded')), timeout))
	]);
}

async function trySettle() {
  let merkleRoot = await getMerkle();
  console.log("typeof :", typeof(merkleRoot[0]));
  console.log(merkleRoot);
  try {
    let record = await modelBundle.findOne({ merkleRoot: merkleRoot});
    if (record) {
      let taskId = record.taskId;
      let data0 = await getTaskWithTimeout(taskId, 20000);

      if (data0.proof.length == 0) {
        throw new Error("proving not complete!");
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
      let proxyInfo = await proxy.getProxyInfo();

      const tx = await proxy.verify(
        txData,
        proofArr,
        verifyInstancesArr,
        auxArr,
        [instArr],
        [proxyInfo.rid.toString(), "1"]
      );
      // wait for tx to be mined, can add no. of confirmations as arg
      const receipt = await tx.wait();
      console.log("transaction:", tx.hash);
      console.log("receipt:", receipt);
    } else {
      console.log(`proof bundle ${merkleRoot} not found`);
    }
  } catch(e) {
    console.log("get bundle error");
    console.log(e);
  }
}

// start monitoring and settle
async function main() {
 while (true) {
     await trySettle();
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
