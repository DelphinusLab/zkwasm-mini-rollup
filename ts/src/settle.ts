import BN from "bn.js";
import { ethers } from "ethers";
import { ServiceHelper, contract_addr, modelBundle, priv } from "./config.js";
import abiData from './Proxy.json' assert { type: 'json' };
import mongoose from 'mongoose';
import {PaginationResult, QueryParams, Task, VerifyProofParams} from "zkwasm-service-helper";

let mongodbUri = "localhost";

if (process.env.URI) {
  mongodbUri = process.env.URI; //"mongodb:27017";
}

// Replace with your network configuration
const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
const signer = new ethers.Wallet(priv, provider);
//
const constants = {
  proxyAddress: contract_addr,
};

export class NumberUtil {
    bn: BN;
    constructor(num: number) {
        this.bn = new BN(num);
    }
    toBN(){
        let bns = new Array<BN>();
        let bnStr = this.bn.toString("hex", 64)
        for (let i = 0; i < bnStr.length; i += 16) {
            const chunk = bnStr.slice(i, i + 16);
            let a = new BN(chunk, 'hex', 'be');
            bns.push(a);
        }
        return bns;
    }
    toNumber() {
        return this.toBN().map((x) => x.toString(10));
    }
}

async function getMerkle(): Promise<Array<string>>{
  // Connect to the Proxy contract
  const proxy = new ethers.Contract(constants.proxyAddress, abiData.abi, provider);
  // Fetch the proxy information
  let proxyInfo = await proxy.getProxyInfo();
  console.log("Proxy Info:", proxyInfo);
  // Extract the old Merkle root
  const oldRoot = proxyInfo.merkle_root;
  console.log("Old Merkle Root:", oldRoot);
  let oldRootU64Array = new NumberUtil(oldRoot.toString()).toNumber();
  console.log("Old Merkle Root U64 Array:", oldRootU64Array);
  return oldRootU64Array;
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
  console.log(merkleRoot);
  try {
    let record = await modelBundle.findOne({ merkleRoot: merkleRoot});
    if (record) {
      let taskId = record.taskId;
      let task = await getTask(taskId);
      let verify_instance =
          task.shadow_instances.length === 0
          ? task.batch_instances
          : task.shadow_instances;
      let verifyProofParams: VerifyProofParams = {
          aggregate_proof: task.proof,
          verify_instance: verify_instance,
          aux: task.aux,
          instances: [task.instances], // The target instances are wrapped in an array
      };
      // verify proof
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
