import mongoose, { Schema } from 'mongoose';
export interface Bidder {
  bidprice: bigint;
  bidder: bigint[];
}

export interface MarketInfo<O> {
    marketid: bigint;
    askprice: bigint;
    settleinfo: bigint;
    bidder: Bidder | null;
    object: O;
}

export interface Decodable<O> {
    fromData(u64datasource: bigint[]): O
}

export function fromData<O>(u64datasource: bigint[], decoder: Decodable<O>): MarketInfo<O> {
  const u64data = u64datasource.slice();
  // Ensure there are at least three elements.
  if (u64data.length < 3) {
    throw new Error("Not enough data to construct a Card");
  }

  const marketid: bigint = u64data.shift()!;
  const askprice: bigint = u64data.shift()!;
  const settleinfo: bigint = u64data.shift()!;



  // Map each byte to a signed 8-bit integer.
  // For byte values greater than 127, subtract 256 to get the signed representation.
  //const attributes = leBytes.map(b => (b > 127 ? b - 256 : b));

  let bidder = null;
  if (settleinfo != 0n) {
    bidder = {
      bidprice: u64data.shift()!,
      bidder: [u64data.shift()!, u64data.shift()!]
    }
  }

  // Consume data from the beginning of the array.
  const object = decoder.fromData(u64data);

  // Return the constructed Card object.
  return {
    marketid: marketid,
    askprice: askprice,
    settleinfo: settleinfo,
    bidder: bidder,
    object: object,

  };
}

// recursive masker that applies to bigints or arrays of bigints
function maskUint64(v: any): any {
    if (typeof v === 'bigint') {
        return BigInt.asUintN(64, v);
    }
    if (Array.isArray(v)) {
        return v.map(maskUint64);
    }
    // if you have nested plain objects you also want to walk, you could:
    if (v !== null && typeof v === 'object') {
        for (const k of Object.keys(v)) {
            v[k] = maskUint64(v[k]);
        }
    }
    return v;
}

function uint64FetchPlugin(next: any, rawDoc: any) {
    return maskUint64(rawDoc);
}


const BidderSchema = new mongoose.Schema<Bidder>({
  bidprice:  { type: BigInt, required: true },
  bidder:    { type: [BigInt], required: true }
});

// Define the schema for the Token model
export const marketObjectSchema = new mongoose.Schema({
    marketid: { type: BigInt, required: true, unique: true},
    askprice: { type: BigInt, require: true},
    settleinfo: { type: BigInt, require: true},
    bidder: { type: BidderSchema, require: false},
    object: { type: Schema.Types.Mixed, require: true},
});

marketObjectSchema.pre('init', uint64FetchPlugin);

// Utility function to convert a bigint to an array of 8 bytes in little-endian order.
function toLEBytes(num: bigint): number[] {
  const bytes: number[] = [];
  const mask = 0xffn;
  for (let i = 0; i < 8; i++) {
    bytes.push(Number(num & mask));
    num = num >> 8n;
  }
  return bytes;
}



