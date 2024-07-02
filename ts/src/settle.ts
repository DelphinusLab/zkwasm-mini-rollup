import BN from "bn.js";
import { ZKWasmAppRpc } from "./rpc.js";
import {LeHexBN} from "./sign.js";
import ethers from "ethers";
import { user_addr } from "./config.js";

// Replace with your network configuration
const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
const signer = provider.getSigner(); // Ensure this signer has the necessary permissions
//
const constants = {
  proxyAddress: user_addr,
};

function toU64ArrayBE(b: BN): Array<bigint>{
    let bns = new Array<bigint>();
    let bnStr = b.toString("hex", 64)
    for (let i = 0; i < bnStr.length; i += 16) {
        const chunk = bnStr.slice(i, i + 16);
        let a = BigInt(`0x${chunk}n`);
        bns.push(a);
    }
    return bns;
}

async function getMerkle(): Promise<Array<bigint>>{
  // Connect to the Proxy contract
  /*
  const proxy = new ethers.Contract("", provider);
  const proxy = await ethers.getContractAt("Proxy", constants.proxyAddress, signer);
  // Fetch the proxy information
  let proxyInfo = await proxy.getProxyInfo();
  console.log("Proxy Info:", proxyInfo);
  // Extract the old Merkle root
  const oldRoot = proxyInfo.merkle_root;
  console.log("Old Merkle Root:", oldRoot);
  const oldRootU64Array = toU64ArrayBE(oldRoot);
  console.log("Old Merkle Root U64 Array:", oldRootU64Array);
  */
  return [0n,0n,0n,0n]
}

async function trySettle() {
  let merkle_root = await getMerkle();
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

getMerkle();
