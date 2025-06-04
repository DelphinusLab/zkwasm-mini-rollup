import mongoose, { Document, Model, SchemaType } from 'mongoose';
import { Decodable, uint64FetchPlugin } from './object.js';

export interface PositionInfo<O> {
    oid: bigint;
    pid: bigint[];
    object: O;
}

export function fromData<O>(u64datasource: bigint[], decoder: Decodable<O>): PositionInfo<O> {
  const u64data = u64datasource.slice();
  // Ensure there are at least three elements.
  if (u64data.length < 4) {
    throw new Error("Not enough data to construct an ObjectInfo");
  }

  const oid = u64data.shift()!;
  const pid = [u64data.shift()!, u64data.shift()!];

  // Map each byte to a signed 8-bit integer.
  // For byte values greater than 127, subtract 256 to get the signed representation.
  //const attributes = leBytes.map(b => (b > 127 ? b - 256 : b));

  // Consume data from the beginning of the array.
  const object = decoder.fromData(u64data);

  // Return the constructed Card object.
  return {
    oid,
    pid,
    object: object,
  };
}

export function createPositionSchema(ObjectSchema: SchemaType) {
    // Define the schema for the Token model
    const objectSchema = new mongoose.Schema({
        oid: { type: BigInt, required: true, unique: true},
        pid: { type: [BigInt], require: true},
        object: { type: ObjectSchema, require: true},
    });
    objectSchema.pre('init', uint64FetchPlugin);
    return objectSchema;
}

export class PositionEvent<O> {
    oid: bigint;
    pid: bigint[];
    data: bigint[];
    decoder: Decodable<O>;

    constructor(oid: bigint, pid: bigint[], data: bigint[], decoder: Decodable<O>) {
        this.oid = oid;
        this.pid = pid;
        this.data = data;
        this.decoder = decoder;
    }

    toObject() {
        return this.decoder.fromData(this.data);
    }

    toJSON() {
      return JSON.stringify(this.toObject());
    }

    static fromEvent<O>(data: BigUint64Array, decoder: Decodable<O>): PositionEvent<O> {
        return new PositionEvent<O>(data[0], [data[1], data[2]], Array.from(data.slice(3)), decoder)
    }

    async storeRelatedObject<T extends Document>(model: Model<T>) {
        let obj = this.toObject() as any;
        let doc = await model.findOneAndUpdate({oid: this.oid, pid: this.pid}, obj, {upsert: true});
        return doc;
    }
}


