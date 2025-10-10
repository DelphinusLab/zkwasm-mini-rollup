import mongoose from 'mongoose';
import { TxWitness, syncToFirstUnprovedBundle, submitProof } from './prover.js';
import { merkleRootToBeHexString, hexStringToMerkleRoot } from './lib.js';
import { ZkWasmServiceHelper } from 'zkwasm-service-helper';
import { endpoint, get_image_md5 } from './config.js';
import { GlobalBundleService } from './services/global-bundle-service.js';
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

// Ensure indexes exist on collections - create if needed
const ensureIndexes = async () => {
  try {
    const collection = CommitModel.collection;
    
    // Check if database and collection exist first
    const db = (collection as any).db;
    const collections = await db.listCollections({ name: collection.collectionName }).toArray();
    
    if (collections.length === 0) {
      console.log('Collection does not exist yet, index will be created automatically from schema');
      return; // Schema already defines the index, so it will be created when collection is first used
    }
    
    // Collection exists, check if index exists
    const indexes = await collection.indexes();
    const keyIndexExists = indexes.some(index => 
      index.key && index.key.key === 1
    );
    
    if (!keyIndexExists) {
      console.log('Creating index on key field...');
      await collection.createIndex({ key: 1 });
      console.log('Index on key field created successfully');
    } else {
      console.log('Index on key field already exists');
    }
  } catch (error: any) {
    if (error.code === 26 && error.codeName === 'NamespaceNotFound') {
      console.log('Collection does not exist yet, index will be created from schema on first use');
    } else {
      console.error('Error ensuring indexes:', error);
    }
  }
};

// Export function to be called after MongoDB connection
export { ensureIndexes };

interface QueryResult {
  success: boolean;
  task?: any;
  merkleRoot?: string;
  error?: string;
}

export class TxStateManager {
    // initial merkle root of a bundle
    currentUncommitMerkleRoot: string;
    uncommittedTxs: TxWitness[];
    preemptcounter: number;
    private helper: ZkWasmServiceHelper;
    private imageMd5: string;
    private globalBundleService: GlobalBundleService;

    constructor(merkleRootHexString: string) {
      this.currentUncommitMerkleRoot = merkleRootHexString;
      this.uncommittedTxs = [];
      this.preemptcounter = 0;
      this.helper = new ZkWasmServiceHelper(endpoint, "", "");
      this.imageMd5 = get_image_md5();
      this.globalBundleService = new GlobalBundleService();
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

    private async queryLatestTask(merkleRoot: string): Promise<QueryResult> {
      try {
        const recentTasks = await this.helper.loadTasks({
          md5: this.imageMd5,
          user_address: null,
          id: null,
          tasktype: "Prove",
          taskstatus: "",  // Query all status (empty means all)
          total: 1  // Only get the latest task
        });

        if (recentTasks.data && recentTasks.data.length > 0) {
          const task = recentTasks.data[0] as any;
          
          // Convert merkle root to expected input format for comparison
          const merkleArray = new BigUint64Array(hexStringToMerkleRoot(merkleRoot));
          const expectedInputs = [merkleArray[0], merkleArray[1], merkleArray[2], merkleArray[3]]
            .map(x => `${x}:i64`);

          // Check if this task matches our merkle root
          if (task.public_inputs && 
              task.public_inputs.length >= 4 &&
              task.public_inputs[0] === expectedInputs[0] &&
              task.public_inputs[1] === expectedInputs[1] &&
              task.public_inputs[2] === expectedInputs[2] &&
              task.public_inputs[3] === expectedInputs[3]) {
            
            return {
              success: true,
              task: task,
              merkleRoot: merkleRoot
            };
          }
        }
        
        return {
          success: true,  // Query succeeded, just no matching task
          task: null,     // No matching task found
          error: "No matching task found"
        };
      } catch (error) {
        return {
          success: false,
          error: `Query failed: ${error}`
        };
      }
    }

    async trackUnprovedBundle(guideMerkle: BigUint64Array): Promise<BigUint64Array | null> {
      // Find the first unproved bundle starting from guideMerkle
      let bundle = await syncToFirstUnprovedBundle(guideMerkle);
      if (bundle == null) {
        // No unproved bundle found, nothing to track
        return null;
      }

      let merkleRoot = bundle.merkleRoot;
      let txWitness = await this.getTxFromCommit(merkleRoot);
      
      // Try to query once - let outer setInterval handle retries
      const queryResult = await this.queryLatestTask(merkleRoot);
      
      if (queryResult.success) {
        // Query succeeded
        if (queryResult.task) {
          // Task found and matched - this bundle is confirmed
          console.log(`Bundle ${merkleRoot} already confirmed, bundle processing complete`);
          
          // Extract post merkle root from task instances (indices 4-7)
          let postMerkleRoot = '';
          if (queryResult.task.instances && queryResult.task.instances.length >= 384) {
            const { ZkWasmUtil } = await import('zkwasm-service-helper');
            const instances = ZkWasmUtil.bytesToBN(queryResult.task.instances);
            
            if (instances.length >= 8) {
              const nextMerkle = new BigUint64Array([
                BigInt(instances[4].toString()),
                BigInt(instances[5].toString()),
                BigInt(instances[6].toString()),
                BigInt(instances[7].toString())
              ]);
              postMerkleRoot = merkleRootToBeHexString(nextMerkle);
            }
          }
          
          // Update bundle with confirmed task info  
          await this.globalBundleService.updateBundle(merkleRoot, {
            taskId: queryResult.task._id.$oid || queryResult.task._id,  // Handle MongoDB ObjectId format
            postMerkleRoot: postMerkleRoot
          });
          
          // This bundle is done, return null to let syncToFirstUnprovedBundle find the next one
          return null;
        } else {
          // Query succeeded but no matching task found - need to submit proof
          console.log(`No confirmed task found for bundle ${merkleRoot}, submitting proof...`);
          try {
            const merkleArray = new BigUint64Array(hexStringToMerkleRoot(merkleRoot));
            // Convert Buffer to Uint8Array for submitProof
            const txdataUint8 = bundle.txdata ? new Uint8Array(bundle.txdata) : new Uint8Array(0);
            const taskId = await submitProof(merkleArray, txWitness, txdataUint8);
            
            // Update bundle with submitted task info
            await this.globalBundleService.updateBundle(merkleRoot, {
              taskId: taskId  // taskId is response.id from submitProof
            });
            
            console.log(`Proof submitted for bundle ${merkleRoot}, task ID: ${taskId}`);
            
            // Return current merkle to keep tracking this bundle until confirmed
            return new BigUint64Array(hexStringToMerkleRoot(merkleRoot));
            
          } catch (submitError) {
            console.error(`Failed to submit proof for bundle ${merkleRoot}:`, submitError);
            return null;
          }
        }
      } else {
        // Query failed - let outer setInterval retry in 30 seconds
        console.log(`Query failed for bundle ${merkleRoot}: ${queryResult.error}, will retry in next interval`);
        return null;
      }
    }
}

