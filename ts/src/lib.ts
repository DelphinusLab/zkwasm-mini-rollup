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
}

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
    toU64StringArray() {
        return this.toBN().map((x) => x.toString(10));
    }
}

export function merkleRootToBeHexString(root: BigUint64Array) {
  let bigint = root[0] + (root[1]<<64n) + (root[2]<<128n) + (root[3]<<192n);
  let bnStr = bigint.toString(10);
  let bn = new BN(bnStr, 10);
  return bn.toString("hex", 64);
}
