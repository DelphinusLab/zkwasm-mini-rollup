import { BN } from "bn.js";
import { Point } from "delphinus-curves/src/altjubjub";

function littleEndianHexToBN(hexString: string) {
  // Remove the '0x' prefix if it exists
  console.log("hexString is", hexString);
  if (hexString.startsWith('0x')) {
    hexString = hexString.slice(2);
  }

  // Ensure the hex string has an even length
  if (hexString.length % 2 !== 0) {
    hexString = '0' + hexString;
  }

  // Reverse the hex string to convert it from little-endian to big-endian
  let reversedHex = '';
  for (let i = hexString.length - 2; i >= 0; i -= 2) {
    reversedHex += hexString.slice(i, i + 2);
  }

  // Create a BN instance from the big-endian hex string
  return new BN(reversedHex, 16);
}

export class LeHexBN {
  hexstr: string;
  constructor(hexstr: string) {
    this.hexstr = hexstr;
  };
  toBN() {
    return littleEndianHexToBN(this.hexstr);
  }
}

export function verify_sign(msg: LeHexBN, pkx: LeHexBN, pky: LeHexBN, rx:LeHexBN, ry:LeHexBN, s:LeHexBN): boolean {
  let l = Point.base.mul(s.toBN());
  let pkey = new Point(pkx.toBN(), pky.toBN());
  let r = (new Point(rx.toBN(), ry.toBN())).add(pkey.mul(msg.toBN()))
  console.log(l);
  console.log(r);
  const negr  = new Point(r.x.neg(), r.y);
  console.log(negr);
  console.log(l.add(negr));
  return (l.add(negr).isZero());
}

