import BN from "bn.js";
import { ethers } from "ethers";
import { ServiceHelper, contract_addr, modelBundle, priv } from "./config.js";
import abiData from './Proxy.json' assert { type: 'json' };
import mongoose from 'mongoose';
import {ZkWasmUtil, PaginationResult, QueryParams, Task, VerifyProofParams} from "zkwasm-service-helper";
import { U8ArrayUtil, NumberUtil } from './lib.js';

let mongodbUri = "localhost";

if (process.env.URI) {
  mongodbUri = process.env.URI; //"mongodb:27017";
}

// Replace with your network configuration
const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
const signer = new ethers.Wallet(priv, provider);
//
const constants = {
  proxyAddress: contract_addr,
};

async function getMerkle(): Promise<Array<String>>{
  // Connect to the Proxy contract
  const proxy = new ethers.Contract(constants.proxyAddress, abiData.abi, provider);
  // Fetch the proxy information
  let proxyInfo = await proxy.getProxyInfo();
  console.log("Proxy Info:", proxyInfo);
  // Extract the old Merkle root
  const oldRoot = proxyInfo.merkle_root;
  console.log("Old Merkle Root:", oldRoot);
  let oldRootBeString = oldRoot.toString("hex", 64);
  //let oldRootU64Array = new NumberUtil(oldRoot.toString()).toU64StringArray();
  //console.log("Old Merkle Root U64 Array:", oldRootU64Array);
  //return oldRootU64Array;
  return oldRootBeString;
}

mongoose.connect(`mongodb://${mongodbUri}/job-tracker`, {
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
          md5: null,
          total: 1,
        };

  const response: PaginationResult<Task[]> = await ServiceHelper.loadTasks(
    queryParams
  );
  return response.data[0];
}

async function trySettle() {
  let merkleRoot = await getMerkle();
  console.log("typeof :", typeof(merkleRoot[0]));
  console.log(merkleRoot);
  try {
    let record = await modelBundle.findOne({ merkleRoot: merkleRoot});
    if (record) {
      let taskId = record.taskId;
      let data0 = await getTask(taskId);
      //console.log(data0);
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

while (true) {
  await trySettle();
  await new Promise(resolve => setTimeout(resolve, 5000));
}
