import BN from "bn.js";
import { ethers } from "ethers";
import { get_contract_addr} from "./config.js";
import abiData from './Proxy.json' assert { type: 'json' };

export let provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
if (process.env.RPC_PROVIDER) {
  provider = new ethers.JsonRpcProvider(process.env.RPC_PROVIDER);
}

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

export async function getMerkle(): Promise<String>{
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

