import BN from "bn.js";
import { ethers } from "ethers";

function bytesToHex(bytes: Array<number>): string  {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToDecimal(bytes: Array<number>): string  {
  const bigInt = BigInt("0x" + bytesToHex(bytes)); // Convert bytes to hex string and then to BigInt
  return bigInt.toString(); // Convert the BigInt to a decimal string
}

export function composeWithdrawParams(addressBN: BN, amount: bigint) {
    const addressBE = addressBN.toArray("be", 20); // 20 bytes = 160 bits and split into 4, 8, 8
    const firstLimb = BigInt('0x' + bytesToHex(addressBE.slice(0,4).reverse()));
    const sndLimb = BigInt('0x' + bytesToHex(addressBE.slice(4,12).reverse()));
    const thirdLimb = BigInt('0x' + bytesToHex(addressBE.slice(12, 20).reverse()));
    return [(firstLimb << 32n) + amount, sndLimb, thirdLimb];
}

export class TransactionData {
  nonce: bigint;
  feature: bigint;
  command: bigint;
  params: BigUint64Array;
  constructor(nonce: bigint, feature: bigint, command: bigint, params: BigUint64Array) {
    this.nonce = nonce;
    this.feature = feature;
    this.command = command;
    this.params = params;
  }
  encodeCommand() {
    return [...this.params, (this.nonce << 16n) + (this.feature << 8n) + this.command]
  }

}

export function decodeWithdraw(txdata: Uint8Array) {
  let r = [];
  if (txdata.length > 1) {
    for (let i = 0; i < txdata.length; i += 32) {
      let extra = txdata.slice(i, i+4);
      let address = txdata.slice(i+4, i+24);
      let amount = txdata.slice(i+24, i+32);
      let amountInWei = ethers.parseEther(bytesToDecimal(Array.from(amount)));
      r.push({
        op: extra[0],
        index: extra[1],
        address: ethers.getAddress(bytesToHex(Array.from(address))),
        amount: amountInWei,
      });
    }
    console.log(r);
  }
  return r;
}


