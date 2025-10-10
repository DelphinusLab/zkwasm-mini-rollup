//import initHostBind, * as hostbind from "./wasmbind/hostbind.js";
import initBootstrap, * as bootstrap from "./bootstrap/bootstrap.js";
import initApplication, * as application from "./application/application.js";
import { test_merkle_db_service } from "./test.js";
import { verifySign, LeHexBN, sign, PlayerConvention, ZKWasmAppRpc, createCommand } from "zkwasm-minirollup-rpc";
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import express, {Express} from 'express';
import { submitProofWithRetry, has_uncomplete_task, TxWitness, get_latest_proof, has_task } from "./prover.js";
import { ensureIndexes } from "./commit.js";
import cors from "cors";
import { get_mongoose_db, modelJob, modelRand, get_service_port, get_server_admin_key, modelTx, get_contract_addr, get_chain_id, get_image_md5 } from "./config.js";
import { GlobalBundleService } from "./services/global-bundle-service.js";
import { StateSnapshotService } from "./services/state-snapshot-service.js";
import { StateMigrationService } from "./services/migration-service.js";
import { getMerkleArray } from "./contract.js";
import { ZkWasmUtil } from "zkwasm-service-helper";
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {hexStringToMerkleRoot, merkleRootToBeHexString} from "./lib.js";
import {sha256} from "ethers";
import {TxStateManager} from "./commit.js";
import {queryAccounts, storeAccount} from "./account.js";
import {decodeWithdraw} from "./convention.js";

// Load environment variables from .env file
dotenv.config();

let deploymode = false;
let remote = false;
let migrate = false;
let redisHost = 'localhost';

// First, check if there are uncompleted tasks (Pending/Processing) and wait for completion
// This ensures we don't miss tasks that are currently being processed
if (await has_uncomplete_task()) {
  console.log("Found uncompleted tasks (Pending/Processing), waiting for completion before determining mode...");
  while (await has_uncomplete_task()) {
    console.log("Tasks still processing, waiting 10 seconds...");
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  console.log("All uncompleted tasks have finished.");
}

// Now check if there are successfully completed tasks (Done status)
// if md5 is invalid, this will throw an error; if unspecified, this will return false
let hasTask = await has_task();
let contractAddr = get_contract_addr();

if (process.env.DEPLOY) {
  deploymode = true;
}

if (hasTask) {
  remote = true;
}

if (!hasTask && contractAddr != "unspecified") {
  try {
    let merkleRoot = await getMerkleArray();
    console.log('migrate merkle root:', merkleRoot);
    migrate = true;
  } catch (e) {
    console.log(e);
  }
}

if (process.env.REDISHOST) {
  redisHost = process.env.REDISHOST;
}

let taskid: string | null = null;

if (process.env.TASKID) {
  taskid = process.env.TASKID;
}

/* Global Params */

let transactions_witness = new Array();

let snapshot = JSON.parse("{}");

function randByte()  {
  return Math.floor(Math.random() * 0xff);
}

async function generateRandomSeed() {
  let randSeed = [randByte(), randByte(), randByte(), randByte(), randByte(), randByte(), randByte(), randByte()];
  let sha = sha256(new Uint8Array(randSeed));
  const mask64 = BigInt("0xFFFFFFFFFFFFFFFF");
  const shaCommitment = BigInt(sha) & mask64;
  const randRecord = new modelRand({
    commitment: shaCommitment.toString(),
    seed: randSeed,
  });
  try {
    await randRecord.save();
    //console.log("Generated Rand Seed:", randSeed, shaCommitment);
    return shaCommitment;
  } catch (e) {
    console.log("Generating random seed error!");
    process.exit(1)
  }
}

export class Service {
  worker: null | Worker;
  queue: null | Queue;
  txCallback: (arg: TxWitness, events: BigUint64Array) => Promise<void>;
  txBatched: (arg: TxWitness[], preMerkleHexRoot: string, postMerkleRoot: string ) => Promise<void>;
  playerIndexer: (arg: any) => number;
  registerAPICallback: (app: Express) => void;
  merkleRoot: BigUint64Array;
  bundleIndex: number;
  preMerkleRoot: BigUint64Array | null;
  txManager: TxStateManager;
  blocklist: Map<string, number>;
  globalBundleService: GlobalBundleService;
  currentMD5: string;
  stateSnapshotService: StateSnapshotService;
  migrationService: StateMigrationService;

  constructor(
      cb: (arg: TxWitness, events: BigUint64Array) => Promise<void> = async (arg: TxWitness, events: BigUint64Array) => {},
      txBatched: (arg: TxWitness[], merkleHexRoot: string, postMerkleRoot: string)=> Promise<void> = async (arg: TxWitness[], merkleHexRoot: string, postMerkleRoot: string) => {},
      registerAPICallback: (app: Express) => void = (app: Express) => {},
      registerPlayerIndexer: (player: any) => number = (player: any) => {return 0},
  ) {
    this.worker = null;
    this.queue = null;
    this.txCallback = cb;
    this.txBatched = txBatched;
    this.registerAPICallback = registerAPICallback;
    this.playerIndexer = registerPlayerIndexer;
    this.merkleRoot = new BigUint64Array([
      14789582351289948625n,
      10919489180071018470n,
      10309858136294505219n,
      2839580074036780766n,
    ]);
    this.bundleIndex = 0;
    this.preMerkleRoot = null;
    this.txManager = new TxStateManager(merkleRootToBeHexString(this.merkleRoot));
    this.blocklist = new Map();
    
    // Initialize global Bundle service, state snapshot service and migration service
    this.currentMD5 = get_image_md5();
    this.globalBundleService = new GlobalBundleService();
    this.stateSnapshotService = new StateSnapshotService(
      merkleRootToBeHexString(this.merkleRoot)
    );
    this.migrationService = new StateMigrationService();
  }

  async syncToLatestMerkelRoot() {
    let currentMerkle = merkleRootToBeHexString(this.merkleRoot);
    let prevMerkle = null;
    // Filter by current MD5 to only sync bundles from same application version
    let bundle = await this.findBundleByMerkle(currentMerkle, true);
    while (bundle != null && bundle.postMerkleRoot != null) {
      const postMerkle = new BigUint64Array(hexStringToMerkleRoot(bundle.postMerkleRoot));
      console.log("sync merkle:", currentMerkle, "taskId:", bundle.taskId, "MD5:", bundle.imageMD5);
      bundle = await this.findBundleByMerkle(merkleRootToBeHexString(postMerkle), true);
      if(bundle != null) {
        currentMerkle = bundle.merkleRoot;
        prevMerkle = bundle.preMerkleRoot;
        this.bundleIndex += 1;
      }
    }
    console.log("final merkle:", currentMerkle, "MD5:", this.currentMD5);
    this.merkleRoot = new BigUint64Array(hexStringToMerkleRoot(currentMerkle));
    if (prevMerkle) {
      this.preMerkleRoot = new BigUint64Array(hexStringToMerkleRoot(prevMerkle));

    }
  }

  async findBundleByMerkle(merkleHexRoot: string, filterByCurrentMD5: boolean = false) {
    const imageMD5 = filterByCurrentMD5 ? this.currentMD5 : undefined;
    const prevBundle = await this.globalBundleService.findBundleByMerkle(merkleHexRoot, imageMD5);
    return prevBundle;
  }

  async findBundleIndex(merkleRoot: BigUint64Array) {
      try {
        // Filter by current MD5 when finding bundle index
        const prevBundle = await this.globalBundleService.findBundleByMerkle(
          merkleRootToBeHexString(merkleRoot),
          this.currentMD5
        );
        if (prevBundle != null) {
          return prevBundle!.bundleIndex;
        } else {
          throw Error("BundleNotFound");
        }
      } catch (e) {
        console.log(`fatal: bundle for ${merkleRoot} is not recorded`);
        process.exit();
      }
  }

  async trackBundle(taskId: string, txdata?: Uint8Array) {
    console.log("Tracking bundle in global registry:", this.bundleIndex);
    let preMerkleRootStr = "";
    if (this.preMerkleRoot != null) {
      preMerkleRootStr = merkleRootToBeHexString(this.preMerkleRoot);
      console.log("update merkle chain ...", preMerkleRootStr);
      try {
        // Filter by current MD5 when looking up previous bundle
        const prevBundle = await this.globalBundleService.findBundleByMerkle(preMerkleRootStr, this.currentMD5);
        if (!prevBundle) {
          throw Error(`fatal: can not find bundle for previous MerkleRoot: ${preMerkleRootStr}`);
        }

        if (this.bundleIndex != prevBundle!.bundleIndex) {
          console.log(`fatal: bundleIndex does not match: ${this.bundleIndex}, ${prevBundle!.bundleIndex}`);
          throw Error(`Bundle Index does not match: current index is ${this.bundleIndex}, previous index is ${prevBundle!.bundleIndex}`);
        }
        console.log("merkle chain prev is", prevBundle);

        // Update chain relationships in global Bundle registry
        await this.globalBundleService.updateBundle(preMerkleRootStr, {
          postMerkleRoot: merkleRootToBeHexString(this.merkleRoot)
        });
      } catch (e) {
        console.log(`fatal: can not find bundle for previous MerkleRoot: ${merkleRootToBeHexString(this.preMerkleRoot)}`);
        throw Error(`fatal: can not find bundle for previous MerkleRoot: ${merkleRootToBeHexString(this.preMerkleRoot)}`);
      }
    }
    this.bundleIndex += 1;
    console.log("add transaction bundle:", this.bundleIndex, merkleRootToBeHexString(this.merkleRoot));
    
    // Store raw txdata for later parsing
    console.log(`Storing txdata of length: ${txdata ? txdata.length : 0} bytes`);
    
    try {
      // Store to global Bundle registry with raw txdata as Buffer
      await this.globalBundleService.createBundle({
        merkleRoot: merkleRootToBeHexString(this.merkleRoot),
        preMerkleRoot: preMerkleRootStr,
        postMerkleRoot: '',
        taskId: taskId,
        bundleIndex: this.bundleIndex,
        settleStatus: 'waiting',
        settleTxHash: '',
        txdata: txdata ? Buffer.from(txdata) : null
      }, this.currentMD5);
      
      console.log(`Bundle tracked globally for MD5: ${this.currentMD5}`);
    } catch (e) {
      // Handle conflicts in global registry
      try {
        await this.globalBundleService.updateBundle(merkleRootToBeHexString(this.merkleRoot), {
          taskId: taskId,
          postMerkleRoot: '',
          preMerkleRoot: preMerkleRootStr,
          bundleIndex: this.bundleIndex
        });
        console.log("Updated existing bundle in global registry");
      } catch (globalError) {
        console.log("fatal: conflict in global bundle registry");
        throw globalError;
      }
    }
  }


  async install_transactions(tx: TxWitness, jobid: string | undefined, events: BigUint64Array, isReplay = false) {
    // const installStartTime = Date.now();
    console.log("installing transaction into rollup ...");
    transactions_witness.push(tx);
    // if (!isReplay) {
    // const insertStart = Date.now();
    const handled = await this.txManager.insertTxIntoCommit(tx);
    // const insertEnd = Date.now();
    // console.log(`[${new Date().toISOString()}] insertTxIntoCommit took: ${insertEnd - insertStart}ms, handled: ${handled}`);
    if (handled == false) {
        // const callbackStart = Date.now();
        await this.txCallback(tx, events);
        // const callbackEnd = Date.now();
        // console.log(`[${new Date().toISOString()}] txCallback took: ${callbackEnd - callbackStart}ms`);
    }
    // }
    
    // Event data snapshots removed: events are transaction processing outputs, not recoverable state data
    // Events are already processed by txCallback and stored in system collections
    
    snapshot = JSON.parse(application.snapshot());
    console.log("transaction installed, rollup pool length is:", transactions_witness.length);
    try {
      // const saveStart = Date.now();
      const txRecord = new modelTx(tx);
      await txRecord.save();
      // const saveEnd = Date.now();
      // console.log(`[${new Date().toISOString()}] txRecord.save took: ${saveEnd - saveStart}ms`);
    } catch (e) {
      console.log("fatal: store tx failed ... process will terminate");
    }
    if (application.preempt()) {
      // const preemptStart = Date.now();
      console.log("rollup reach its preemption point, generating proof:");
      let txdata = application.finalize();
      // const finalizeEnd = Date.now();
      // console.log(`[${new Date().toISOString()}] application.finalize took: ${finalizeEnd - preemptStart}ms`);
      console.log("txdata is:", txdata);
      let task_id = null;

      // TODO: store a bundle before we fail
      // let bundle = await this.trackBundle('');
      if (deploymode) {
        try {
          task_id = await submitProofWithRetry(this.merkleRoot, transactions_witness, txdata);
        } catch (e) {
          console.log(e);
          process.exit(1); // this should never happen and we stop the whole process
        }
      }
      try {
        console.log("proving task submitted at:", task_id);
        console.log("tracking task in db current ...", merkleRootToBeHexString(this.merkleRoot));

        await this.trackBundle(task_id, txdata);

        // clear witness queue and set preMerkleRoot
        transactions_witness = new Array();
        this.preMerkleRoot = this.merkleRoot;

        // need to update merkle_root as the input of next proof
        this.merkleRoot = application.query_root();
        
        // New: Create state snapshot after Bundle completion
        const bundleEndMerkleRoot = merkleRootToBeHexString(this.merkleRoot);
        this.stateSnapshotService.updateMerkleRoot(bundleEndMerkleRoot);
        
        // Create state snapshot asynchronously without blocking Bundle processing
        this.stateSnapshotService.createCompleteSnapshot()
          .then(() => {
            console.log(`State snapshot created for: ${bundleEndMerkleRoot}`);
          })
          .catch((snapshotError) => {
            console.warn(`Failed to create state snapshot for ${bundleEndMerkleRoot}:`, snapshotError);
          });


        // record all the txs externally so that the external db can preserve a snap shot
        // const batchStart = Date.now();
        await this.txBatched(transactions_witness, merkleRootToBeHexString(this.preMerkleRoot), merkleRootToBeHexString(this.merkleRoot));
        // const batchEnd = Date.now();
        // console.log(`[${new Date().toISOString()}] txBatched took: ${batchEnd - batchStart}ms`);

        // reset application here
        console.log("restore root:", this.merkleRoot);
        // const resetStart = Date.now();
        await (initApplication as any)(bootstrap);
        application.initialize(this.merkleRoot);
        await this.txManager.moveToCommit(merkleRootToBeHexString(this.merkleRoot));

        // Update state snapshot service MerkleRoot to new Bundle's initial state
        this.stateSnapshotService.updateMerkleRoot(merkleRootToBeHexString(this.merkleRoot));
      } catch (e) {
        console.log(e);
        process.exit(1); // this should never happen and we stop the whole process
      }
    }
    let current_merkle_root = application.query_root();
    // const installEndTime = Date.now();
    console.log("transaction installed with last root:", current_merkle_root);
  }

  async initialize() {
    await mongoose.connect(get_mongoose_db(), {
      //useNewUrlParser: true,
      //useUnifiedTopology: true,
    });

    const db = mongoose.connection;
    db.on('error', () => {
      console.error('fatal: mongoose connection error ... process will terminate');
      process.exit(1);
    });
    db.once('open', () => {
      console.log('Connected to MongoDB');
    });
    
    // Call ensureIndexes after connection is established
    await ensureIndexes();

    console.log("connecting redis server:", redisHost);
    const connection = new IORedis(
      {
        host: redisHost,  // Your Redis server host
        port: 6379,        // Your Redis server port
        reconnectOnError: (err) => {
          console.log("reconnect on error", err);
          return true;
        },
        maxRetriesPerRequest: null  // Important: set this to null
      }
    );

    connection.on('end', () => {
      console.log("fatal: redis disconnected unexpected ...");
      process.exit(1);
    });



    // bootstrap the application
    console.log(`bootstrapping ... (deploymode: ${deploymode}, remote: ${remote}, migrate: ${migrate})`);
    await (initBootstrap as any)();
    //console.log(bootstrap);
    console.log("loading wasm application ...");
    //console.log(application);
    await (initApplication as any)(bootstrap);

    console.log("check merkel database connection ...");
    test_merkle_db_service();

    if (migrate) {
      if (remote) {
        throw Error("Can't migrate in remote mode");
      }
      
      // Get contract state
      this.merkleRoot = await getMerkleArray();
      const targetMerkleRoot = merkleRootToBeHexString(this.merkleRoot);
      console.log("Migrate: target merkle root", targetMerkleRoot);
      
      // Execute data migration to target state
      try {
        await this.migrationService.migrateDataToMerkleRoot(targetMerkleRoot, this.currentMD5);
        console.log(`Migration completed to merkleRoot: ${targetMerkleRoot}`);
      } catch (migrationError) {
        console.error("Migration failed:", migrationError);
        throw migrationError;
      }
    } else if(remote) {
      // Initialize merkle_root based on the latest task
      // Note: We already waited for uncompleted tasks at startup,
      // so we can directly get the latest proof
      let task = await get_latest_proof(taskid);
      console.log("latest taskId got from remote:", task?._id);
      console.log("latest task", task?.instances);
      if (task) {
        const instances = ZkWasmUtil.bytesToBN(task?.instances);
        this.merkleRoot = new BigUint64Array([
          BigInt(instances[4].toString()),
          BigInt(instances[5].toString()),
          BigInt(instances[6].toString()),
          BigInt(instances[7].toString()),
        ]);
        this.preMerkleRoot = new BigUint64Array([
          BigInt(instances[0].toString()),
          BigInt(instances[1].toString()),
          BigInt(instances[2].toString()),
          BigInt(instances[3].toString()),
        ]);

        this.bundleIndex = await this.findBundleIndex(this.preMerkleRoot);
        console.log("updated merkle root", this.merkleRoot, this.bundleIndex);
      }
    } else {
      await this.syncToLatestMerkelRoot();
    }

    console.log("initialize sequener queue ...");
    const myQueue = new Queue('sequencer', {connection});

    const waitingCount = await myQueue.getWaitingCount();
    console.log("waiting Count is:", waitingCount, " perform draining ...");
    await myQueue.drain();

    this.queue = myQueue;

    console.log("initialize application merkle db ...");


    this.txManager.moveToCommit(merkleRootToBeHexString(this.merkleRoot));
    application.initialize(this.merkleRoot);

    // update the merkle root variable
    this.merkleRoot = application.query_root();

    // Automatically add a job to the queue every few seconds
    if (application.autotick()) {
      setInterval(async () => {
        try {
          await myQueue.add('autoJob', {command:0});
        } catch (error) {
          console.error('Error adding automatic job to the queue:', error);
          process.exit(1);
        }
      }, 5000); // Change the interval as needed (e.g., 5000ms for every 5 seconds)
    }

    setInterval(() => {
      this.blocklist.clear();
    }, 30000);

    // Monitor queue length every 2 seconds
    // setInterval(async () => {
    //   try {
    //     const waitingCount = await myQueue.getWaitingCount();
    //     const activeCount = await myQueue.getActiveCount();
    //     const delayedCount = await myQueue.getDelayedCount();
    //     const completedCount = await myQueue.getCompletedCount();
    //     const failedCount = await myQueue.getFailedCount();
    //     
    //     console.log(`[${new Date().toISOString()}] Queue Stats - Waiting: ${waitingCount}, Active: ${activeCount}, Delayed: ${delayedCount}, Completed: ${completedCount}, Failed: ${failedCount}`);
    //   } catch (error) {
    //     console.error('Error getting queue stats:', error);
    //   }
    // }, 2000);

    this.worker = new Worker('sequencer', async job => {
      // const jobStartTime = Date.now();
      // console.log(`[${new Date().toISOString()}] Worker started processing job: ${job.name}, id: ${job.id}`);
      
      if (job.name == 'autoJob') {
        // console.log(`[${new Date().toISOString()}] AutoJob tick started`);
        try {
          let rand = await generateRandomSeed();
          let oldSeed = application.randSeed();
          let seed = 0n;
          if (oldSeed != 0n) {
            const randRecord = await modelRand.find({
              commitment: oldSeed.toString(),
            });
            seed = randRecord[0].seed!.readBigInt64LE();
          };
          let signature = sign(createCommand(0n, 0n, [seed, rand, 0n, 0n]), get_server_admin_key());
          //console.log("signautre is", signature);
          let u64array = signature_to_u64array(signature);
          application.verify_tx_signature(u64array);
          // const handleTxStart = Date.now();
          let txResult = application.handle_tx(u64array);
          // const handleTxEnd = Date.now();
          // console.log(`[${new Date().toISOString()}] AutoJob handle_tx took: ${handleTxEnd - handleTxStart}ms`);
          
          // const installStart = Date.now();
          await this.install_transactions(signature, job.id, txResult);
          // const installEnd = Date.now();
          // console.log(`[${new Date().toISOString()}] AutoJob install_transactions took: ${installEnd - installStart}ms`);
        } catch (error) {
          // const jobEndTime = Date.now();
          // console.log(`[${new Date().toISOString()}] AutoJob failed after ${jobEndTime - jobStartTime}ms:`, error);
          console.log("fatal: handling auto tick error, process will terminate.", error);
          process.exit(1);
        }
        // const jobEndTime = Date.now();
        // console.log(`[${new Date().toISOString()}] AutoJob completed in ${jobEndTime - jobStartTime}ms`);
      } else if (job.name == 'transaction' || job.name == 'replay') {
        console.log("handle transaction ...");
        try {
          let signature = job.data.value;
          let u64array = signature_to_u64array(signature);
          //console.log("tx data", signature);
          application.verify_tx_signature(u64array);
          // const handleTxStart = Date.now();
          let txResult = application.handle_tx(u64array);
          // const handleTxEnd = Date.now();
          // console.log(`[${new Date().toISOString()}] ${job.name} handle_tx took: ${handleTxEnd - handleTxStart}ms`);
          
          let errorCode = txResult[0];
          if (errorCode == 0n) {
            // make sure install transaction will succeed
            // const installStart = Date.now();
            await this.install_transactions(signature, job.id, txResult, job.name=='replay');
            // const installEnd = Date.now();
            // console.log(`[${new Date().toISOString()}] ${job.name} install_transactions took: ${installEnd - installStart}ms`);
            try {
              // If this is the first time of running this tx, the store should work.
              // If the store does not work (jobId conflict) then either there is a jobid
              // conflict error in transaction mode or this is the second time running this
              // transcation thus should in replay mode.
              if (job.name != 'replay') {
                  const jobRecord = new modelJob({
                    jobId: signature.hash + signature.pkx,
                    message: signature.message,
                    result: "succeed",
                  });
                  await jobRecord.save();
              }
            } catch (e) {
              if (job.name != 'replay') {
                // if in replay mode, the tx can not been stored twice thus the error is expected
                console.log("Error: store transaction job error");
                throw e
              }
            }
          } else {
            let errorMsg = application.decode_error(Number(errorCode));
            throw Error(errorMsg)
          }

          // const jobEndTime = Date.now();
          console.log("done");
          let player = null;

          if (job.name != "replay") {
            // in replay mode we do not need the return value for player
            const pkx = new LeHexBN(job.data.value.pkx).toU64Array();
            let jstr = application.get_state(pkx);
            player = JSON.parse(jstr);
          }
          let result = {
            player: player,
            state: snapshot,
            bundle: this.txManager.currentUncommitMerkleRoot,
          };
          return result
        } catch (e) {
          // const jobEndTime = Date.now();
          // console.log(`[${new Date().toISOString()}] ${job.name} failed after ${jobEndTime - jobStartTime}ms:`, e);
          let pkx = job.data.value.pkx;
          let fc = this.blocklist.get(pkx) || 0;
          this.blocklist.set(pkx, fc + 1);
          console.log("error handle_tx", e);
          throw e
        }
      }
    }, {connection});
  }

  async serve() {
    // replay uncommitted transactions
    console.log("install bootstrap txs");
    for (const value of await this.txManager.getTxFromCommit(merkleRootToBeHexString(this.merkleRoot))) {
      this.queue!.add('replay', { value });
    }
    console.log("start express server");
    const app = express();
    const port = get_service_port();

    app.use(express.json());
    app.use(cors());

    app.post('/send', async (req, res) => {
      const value = req.body;
      //console.log("value is", value);
      if (!value) {
        return res.status(400).send('Value is required');
      }

      try {
        const hash = new LeHexBN(value.hash);
        const pkx = new LeHexBN(value.pkx);
        const pky = new LeHexBN(value.pky);
        const sigx = new LeHexBN(value.sigx);
        const sigy = new LeHexBN(value.sigy);
        const sigr = new LeHexBN(value.sigr);
        if (verifySign(hash, pkx, pky, sigx, sigy, sigr) == false) {
          console.error('Invalid signature:');
          res.status(500).send('Invalid signature');
        } else {
          const fc = this.blocklist.get(value.pkx) || 0;
          if (fc > 3) {
            res.status(500).send('This account is blocked for 1 minutes for multiple incorrect arguments');
          } else {
            const job = await this.queue!.add('transaction', { value });
            res.status(201).send({
              success: true,
              jobid: job.id
            });
          }
        }
      } catch (error) {
        console.error('Error adding job to the queue:', error);
        res.status(500).send('Failed to add job to the queue');
      }
    });

    app.post('/querytx', async (req, res) => {
      const value = req.body;
      if (!value) {
        return res.status(400).send('Value is required');
      }
      //console.log("receive query command on: ", value.pkx);
      try {
        const hash = value.hash;
        const pkx = value.pkx;
        let job = await modelJob.findOne({
            jobId: hash + pkx,
        });
        res.status(201).send({
          success: true,
          data: job,
        });
      } catch(e) {
        res.status(500).send('Get Tx Info Error');
      }
    });

    app.post('/query', async (req, res) => {
      const value = req.body;
      if (!value) {
        return res.status(400).send('Value is required');
      }
      //console.log("receive query command on: ", value.pkx);

      try {
        const pkx = new LeHexBN(value.pkx).toU64Array();
        let u64array = new BigUint64Array(4);
        u64array.set(pkx);
        let jstr = application.get_state(pkx);
        let player = JSON.parse(jstr);
        let result = {
          player: player,
          state: snapshot
        }
        await storeAccount(value.pkx, player, this.playerIndexer);
        res.status(201).send({
          success: true,
          data: JSON.stringify(result),
        });

      } catch (error) {
        res.status(500).send('Get Status Error');
      }
    });

    app.get('/data/players/:start?', async(req:any, res) => {
      let start = req.params.start;
      if (Number.isNaN(start)) {
        res.status(201).send({
          success: false,
          data: [],
        });
      } else {
        let data = await queryAccounts(Number(start));
        res.status(201).send({
          success: true,
          data: data,
        });
      }
    });

    app.get('/data/bundles/:merkleroot?', async(req:any, res) => {
      let merkleRootStr = req.params.merkleroot;
      try {
        if (merkleRootStr == 'latest') {
          merkleRootStr = merkleRootToBeHexString(this.preMerkleRoot!);
        }
        // Filter bundle chain by current MD5 to only show bundles from same application version
        const bundles = await this.globalBundleService.getBundleChain(merkleRootStr, 20, this.currentMD5);
        return res.status(201).json({
          success: true,
          data: bundles
        });
      } catch (e: any) {
        return res.status(201).json({
          success: false,
          error: e.toString(),
          data: []
        });
      }
    });

    app.get('/job/:id', async (req, res) => {
      try {
        let jobId = req.params.id;
        const job = await Job.fromId(this.queue!, jobId);
        return res.status(201).json(job);
      } catch (err) {
        // job not tracked
        console.log(err);
        res.status(500).json({ message: (err as Error).toString()});
      }
    });

    app.get('/global', async (req, res) => {
      return res.status(201).json(snapshot);
    });


    app.get('/prooftask/:root', async (req, res) => {
      try {
        let merkleRootString = req.params.root;
        // Filter by current MD5 to only return bundles from same application version
        let record = await this.globalBundleService.findBundleByMerkle(merkleRootString, this.currentMD5);
        if (record) {
          return res.status(201).json(record);
        } else {
          throw Error("TaskNotFound");
        }
      } catch (err) {
        // job not tracked
        console.log(err);
        res.status(500).json({ message: (err as Error).toString()});
      }
    });


    app.post('/config', async (req, res) => {
      try {
        let jstr = application.get_config();
        res.status(201).send({
          success: true,
          data: jstr
        });

      } catch (error) {
        res.status(500).send('Get Status Error');
      }
    });

    this.registerAPICallback(app);

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://0.0.0.0:${port}`);
    });
  }

}

function signature_to_u64array(value: any) {
  const msg = new LeHexBN(value.msg).toU64Array(value.msg.length/16);
  const pkx = new LeHexBN(value.pkx).toU64Array();
  const pky = new LeHexBN(value.pky).toU64Array();
  const sigx = new LeHexBN(value.sigx).toU64Array();
  const sigy = new LeHexBN(value.sigy).toU64Array();
  const sigr = new LeHexBN(value.sigr).toU64Array();

  let u64array = new BigUint64Array(20 + value.msg.length/16);
  u64array.set(pkx, 0);
  u64array.set(pky, 4);
  u64array.set(sigx, 8);
  u64array.set(sigy, 12);
  u64array.set(sigr, 16);
  u64array.set(msg, 20);
  let cmdLength = (msg[0] >> 8n) % 256n;
  if (Number(cmdLength) != msg.length) {
    throw Error("Wrong Command Size");
  }
  return u64array;
}
