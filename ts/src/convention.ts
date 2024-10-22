import BN from "bn.js"
function bytesToHex(bytes: Array<number>): string  {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function composeWithdrawParams(addressBN: BN, amount: bigint) {
    const addressBE = addressBN.toArray("be", 20); // 20 bytes = 160 bits and split into 4, 8, 8
    const firstLimb = BigInt('0x' + bytesToHex(addressBE.slice(0,4).reverse()));
    const sndLimb = BigInt('0x' + bytesToHex(addressBE.slice(4,12).reverse()));
    const thirdLimb = BigInt('0x' + bytesToHex(addressBE.slice(12, 20).reverse()));
    return [(firstLimb << 32n) + amount, sndLimb, thirdLimb];
}

export function decodeWithdraw(txdata: Uint8Array) {
  let r = [];
  for (let i = 0; i < txdata.length; i += 32) {
    let extra = txdata.slice(i, 4);
    let address = txdata.slice(i+4, 20);
    let amount = txdata.slice(i+24, 8);
    r.push({
      op: extra[0],
      index: extra[1],
      address: bytesToHex(Array.from(address)),
      amount: bytesToHex(Array.from(amount)),
    });
  }
  return r;
}


