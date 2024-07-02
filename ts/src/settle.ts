import BN from "bn.js";
import { ZKWasmAppRpc } from "./rpc.js";
import {LeHexBN} from "./sign.js";
import { ethers } from "ethers";
import { user_addr, contract_addr, priv } from "./config.js";
import abiData from './Proxy.json' assert { type: 'json' };

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

async function trySettle() {
  let merkle_root = await getMerkle();
  console.log(merkle_root);
  /*
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', function() {
      console.log("Connected to the database");

      // Search query
    //   User.find({ name: 'John Doe' }, function(err, users) {
    //       if (err) return console.error(err);
    //           console.log(users);
    //             });
    //             });
  */
}

trySettle();
