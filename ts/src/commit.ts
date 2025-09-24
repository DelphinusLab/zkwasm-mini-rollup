import mongoose from 'mongoose';
import { TxWitness } from './prover.js';
const txSchema = new mongoose.Schema({
  msg: { type: String, required: true },
  pkx: { type: String, required: true },
  pky: { type: String, required: true },
  sigx: { type: String, required: true },
  sigy: { type: String, required: true },
  sigr: { type: String, required: true },
});

const commitSchema = new mongoose.Schema({
    key: { type: String, required: true },
    items: { type: [txSchema], default: [] } // List of objects
});

// Add index on key field for fast lookups
commitSchema.index({ key: 1 });

export const CommitModel = mongoose.model('Commit', commitSchema);

// Ensure indexes exist on existing collections - check and create if needed
const ensureIndexes = async () => {
  try {
    const collection = CommitModel.collection;
    const indexes = await collection.indexes();
    const keyIndexExists = indexes.some(index => 
      index.key && index.key.key === 1
    );
    
    if (!keyIndexExists) {
      console.log('Creating index on key field for existing database...');
      await collection.createIndex({ key: 1 });
      console.log('Index on key field created successfully');
    } else {
      console.log('Index on key field already exists');
    }
  } catch (error) {
    console.error('Error ensuring indexes:', error);
  }
};

// Export function to be called after MongoDB connection
export { ensureIndexes };

export class TxStateManager {
    currentUncommitMerkleRoot: string;
    uncommittedTxs: TxWitness[];
    preemptcounter: number;

    constructor(merkleRootHexString: string) {
      this.currentUncommitMerkleRoot = merkleRootHexString;
      this.uncommittedTxs = [];
      this.preemptcounter = 0;
    }

    async getTxFromCommit(key: string): Promise<TxWitness[]> {
      try {
        const commit = await CommitModel.findOne({ key });
        if (commit) {
          console.info(`replay uncommitted transactions for commit ${key}: total ${commit.items.length}`);
          return commit.items.map((x) => {
            return {
              msg: x.msg,
              pkx: x.pkx,
              pky: x.pky,
              sigx: x.sigx,
              sigy: x.sigy,
              sigr: x.sigr,
            };
          });
        } else {
          console.info(`non transactions recorded for commit ${key}`);
          return [];
        }
      } catch (error) {
        console.info(`non transactions recorded for commit ${key}`);
        return [];
      }
    }
    async loadCommit(key: string) {
      this.currentUncommitMerkleRoot = key;
      this.uncommittedTxs = [];
      this.preemptcounter = 0;
      try {
        const commit = await CommitModel.findOne({ key });
        if (commit) {
          console.info(`load commit ${key}: total uncommitted ${commit.items.length}`);
          this.preemptcounter = commit.items.length;
        } else {
          console.info(`non transactions recorded for commit ${key}`);
        }
      } catch (error) {
        console.info(`fatal: can not load target commit`);
        process.exit(1);
      }
    }


    async moveToCommit(key: string) {
      this.currentUncommitMerkleRoot = key;
      this.preemptcounter = 0;
      this.uncommittedTxs = [];
      try {
        await CommitModel.findOneAndUpdate({
          key: key
        }, {
          key: key,
          items: []
        }, {
          upsert: true
        });
      } catch (error) {
        console.info(`fatal: clear commits should not fail`);
        process.exit(1);
      }
    }

    async insertTxIntoCommit (tx: TxWitness): Promise<boolean>{
      const counter = this.preemptcounter;
      const key = this.currentUncommitMerkleRoot;
      this.preemptcounter += 1;
      try {
        const commit = await CommitModel.findOne({ key });
        console.log(`Inserting tx into bundle with key: ${key}`);
        if (commit) {
          // If key exists, push new item to items array
          if (commit.items.length <= counter) {
            commit.items.push(tx);
            await commit.save();
            return false; // new tx, needs track
          } else {
            let trackedTx = commit.items[counter];
            console.assert(tx.sigx == trackedTx.sigx);
            return true; // event already tracked
          }
        } else {
          // If key does not exist, create a new commit record
          const newCommit = new CommitModel({
            key,
            items: [tx], // Insert the new item as the first element
          });
          await newCommit.save();
          return false;
        }
      } catch (error) {
        console.error('Error inserting tx into current bundle:', error);
        throw (error)
      }
    };
}

