import BN from 'bn.js';
export class U8ArrayUtil {
    u8arr: Uint8Array;
    constructor(data: Uint8Array) {
        this.u8arr = data;
    }
    toBN() {
        let bns = new Array<BN>();
        for (let i = 0; i < this.u8arr.length; i += 32) {
            const chunk = this.u8arr.slice(i, i + 32);
            let a = new BN(chunk, 'le');
            bns.push(a);
        }
        return bns;
    }
    toNumber() {
        return this.toBN().map((x) => x.toString(10));
    }

    toHex() {
      let bns = new Array<string>();
      for (let i = 0; i < this.u8arr.length; i += 32) {
          const chunk = this.u8arr.slice(i, i + 32);
          const bytes = "0x"
            + Array.from(chunk)
              .map(byte => byte.toString(16).padStart(2, '0'))
              .join('');
          bns.push(bytes);
      }
      return bns;
    }
}

export function merkleRootToBeHexString(root: BigUint64Array) {
  let bigint = root[3] + (root[2]<<64n) + (root[1]<<128n) + (root[0]<<192n);
  let bnStr = bigint.toString(10);
  let bn = new BN(bnStr, 10);
  return '0x' + bn.toString("hex", 64);
}

export function hexStringToMerkleRoot(hexStr: string) {
  let merkleRootBN = BigInt(hexStr);
  let root = [0n, 0n, 0n, 0n];
  for (let i=0; i<4; i++) {
    root[i] = (merkleRootBN >> BigInt(64 * (3-i))) % (1n << 64n);
  }
  return root;
}
