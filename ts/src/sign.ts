import { BN } from "bn.js";
import { CurveField, Point, PrivateKey, bnToHexLe } from "delphinus-curves/src/altjubjub";

function littleEndianHexToBN(hexString: string) {
  // Remove the '0x' prefix if it exists
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
  toU64Array(): BigUint64Array {
    let values:BigUint64Array = new BigUint64Array(4);
    let num = BigInt("0x" + this.toBN().toString(16));
    for (let i = 0; i < 4; i++) {
        values[i] = num % (1n<<64n);
        num = num >> 64n;
    }
    return values
  }
}

// This is subtl as the Point library is using BN while we prefer use BigInt
export function verify_sign(msg: LeHexBN, pkx: LeHexBN, pky: LeHexBN, rx:LeHexBN, ry:LeHexBN, s:LeHexBN): boolean {
  let l = Point.base.mul(s.toBN());
  let pkey = new Point(pkx.toBN(), pky.toBN());
  let r = (new Point(rx.toBN(), ry.toBN())).add(pkey.mul(msg.toBN()))
  const negr  = new Point(r.x.neg(), r.y);
  return (l.add(negr).isZero());
}

// signning a [u64; 4] message with private key
export function sign(cmd: Array<bigint>, prikey: string) {
  let pkey = PrivateKey.fromString(prikey);
  let r = pkey.r();
  let R = Point.base.mul(r);
  let H = cmd[0] + (cmd[1] << 64n) + (cmd[2] << 128n) + (cmd[3] << 196n);
  let hbn = new BN(H.toString(10));
  let S = r.add(pkey.key.mul(new CurveField(hbn)));
  let pubkey = pkey.publicKey;
  const data = {
    msg: bnToHexLe(hbn),
    pkx: bnToHexLe(pubkey.key.x.v),
    pky: bnToHexLe(pubkey.key.y.v),
    sigx: bnToHexLe(R.x.v),
    sigy: bnToHexLe(R.y.v),
    sigr: bnToHexLe(S.v),
  };
  return data;
}
