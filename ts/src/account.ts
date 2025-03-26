import mongoose, {Schema} from 'mongoose';
const accountSchema = new mongoose.Schema({
  pkx: { type: String, required: true, unique: true },
  data: {
    type: Schema.Types.Mixed,
    required: true
  }
});

const accountModel = mongoose.model("Account", accountSchema);

export async function storeAccount(pkx: string, data: JSON) {
  await accountModel.findOneAndUpdate(
    { pkx: pkx},             // Filter: finds the document by key
    { $set: { data: data} },       // Update operation: sets new data
    { new: true, upsert: true} // Options: return the new doc, upsert if not found, and run validations
  );
}

export async function queryAccounts(start: number) {
  try {
    let doc = await accountModel.find().skip(start).limit(100);
    return doc;
  } catch(e) {
    return []
  }
}
