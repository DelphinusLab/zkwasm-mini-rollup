import mongoose, { Document, Model, SchemaType } from 'mongoose';
export interface Decodable<O> {
    fromData(u64datasource: bigint[]): O
}

// recursive masker that applies to bigints or arrays of bigints
// it make Int to UInt when fetch from mongoose db
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

export function uint64FetchPlugin(_next: any, rawDoc: any) {
    return maskUint64(rawDoc);
}

export interface ObjectInfo<O> {
    oid: bigint;
    object: O;
}

export function fromData<O>(u64datasource: bigint[], decoder: Decodable<O>): ObjectInfo<O> {
  const u64data = u64datasource.slice();
  // Ensure there are at least three elements.
  if (u64data.length < 2) {
    throw new Error("Not enough data to construct an ObjectInfo");
  }

  const objectid: bigint = u64data.shift()!;

  // Map each byte to a signed 8-bit integer.
  // For byte values greater than 127, subtract 256 to get the signed representation.
  //const attributes = leBytes.map(b => (b > 127 ? b - 256 : b));

  // Consume data from the beginning of the array.
  const object = decoder.fromData(u64data);

  // Return the constructed Card object.
  return {
    oid: objectid,
    object: object,

  };
}

export function createObjectSchema(ObjectSchema: SchemaType) {
    // Define the schema for the Token model
    const objectSchema = new mongoose.Schema({
        id: { type: BigInt, required: true, unique: true},
        object: { type: ObjectSchema, require: true},
    });
    objectSchema.pre('init', uint64FetchPlugin);
    return objectSchema;
}

(BigInt.prototype as any).toJSON = function () {
          return this.toString();
};


export class ObjectEvent<O> {
    oid: bigint;
    data: bigint[];
    decoder: Decodable<O>;

    constructor(index: bigint, data: bigint[], decoder: Decodable<O>) {
        this.oid = index;
        this.data = data;
        this.decoder = decoder;
    }

    toObject() {
        return this.decoder.fromData(this.data);
    }

    toJSON() {
      return JSON.stringify(this.toObject());
    }

    static fromEvent<O>(data: BigUint64Array, decoder: Decodable<O>): ObjectEvent<O> {
        return new ObjectEvent<O>(data[0], Array.from(data.slice(1)), decoder)
    }

    async storeRelatedObject<T extends Document>(model: Model<T>) {
        let obj = this.toObject() as any;
        let doc = await model.findOneAndUpdate({oid: this.oid}, obj, {upsert: true});
        return doc;
    }
}
