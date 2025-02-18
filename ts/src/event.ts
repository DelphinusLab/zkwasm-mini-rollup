import mongoose from 'mongoose';

export class Event {
    id: bigint;
    data:BigUint64Array;
    constructor(id: bigint, data: BigUint64Array) {
        this.id = id;
        this.data = data;
    }

    static fromMongooseDoc(doc: mongoose.Document): Event {
        const obj = doc.toObject({
            transform: (doc, ret) => {
                delete ret._id;
                return ret;
            }
        });
        // Convert the Binary data back to a Buffer
        const buffer = obj.buffer;

        // Create a new BigUint64Array from the buffer
        const retrieved = new BigUint64Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 8);

        return new Event(BigInt(obj.id), retrieved);
    }

    toMongooseDoc(): mongoose.Document {
        return new EventModel({
            id: this.id.toString(),
            data: Buffer.from(this.data.buffer)
        });
    }

    toObject(): { id: bigint, data: BigUint64Array } {
        return {
            id: this.id,
            data: this.data
        };
    }

    fromObject(obj: { id: bigint, data: BigUint64Array }): Event {
        return new Event(obj.id, obj.data);
    }

    toJSON():{ id: string, data: string[] }{
        let data = Array.from(this.data).map((x) => x.toString());
        return {
            id: this.id.toString(),
            data: data,
        }
    }

    static fromJSON(obj: { id: string, data: string[] }): Event {
        let data = new BigUint64Array(obj.data.map((x) => BigInt(x)));
        return new Event(BigInt(obj.id), data);
    }
}

// Define the schema
const eventSchema = new mongoose.Schema({
    id: {
        type: String, // We'll convert bigint to string
        required: true,
        unique: true
    },
    data: {
        type: Buffer, // Use Buffer to store the binary data
        required: true
    }
});

// Create the model
export const EventModel = mongoose.model('Event', eventSchema);
