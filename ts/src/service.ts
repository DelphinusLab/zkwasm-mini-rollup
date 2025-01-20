//import initHostBind, * as hostbind from "./wasmbind/hostbind.js";
import initBootstrap, * as bootstrap from "./bootstrap/bootstrap.js";
import initApplication, * as application from "./application/application.js";
import { test_merkle_db_service } from "./test.js";
import { verify_sign, LeHexBN, sign } from "./sign.js";
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import express, {Express} from 'express';
import { submitProofWithRetry, has_uncomplete_task, TxWitness, get_latest_proof } from "./prover.js";
import cors from "cors";
import { get_mongoose_db, modelBundle, modelJob, modelRand, get_service_port, get_server_admin_key, modelTx } from "./config.js";
import { getMerkleArray } from "./contract.js";
import { ZkWasmUtil } from "zkwasm-service-helper";
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {hexStringToMerkleRoot, merkleRootToBeHexString} from "./lib.js";
import {sha256} from "ethers";

// Load environment variables from .env file
dotenv.config();

let deploymode = false;
let remote = false;
let migrate = false;
let redisHost = 'localhost';

if (process.env.DEPLOY) {
  deploymode = true;
}

if (process.env.REMOTE) {
  remote = true;
}

if (process.env.MIGRATE) {
  migrate = true;
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

let merkle_root = new BigUint64Array([
    14789582351289948625n,
    10919489180071018470n,
    10309858136294505219n,
    2839580074036780766n,
  ]);

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
    console.log("Generated Rand Seed:", randSeed, shaCommitment);
    return shaCommitment;
  } catch (e) {
    console.log("Generating random seed error!");
    process.exit(1)
  }
}

export class Service {
  worker: null | Worker;
  queue: null | Queue;
  txCallback: (arg: TxWitness) => void;
  registerAPICallback: (app: Express) => void;

  constructor(cb: (arg: TxWitness) => void, registerAPICallback: (app: Express) => void = (app: Express) => {}) {
    this.worker = null;
    this.queue = null;
    this.txCallback = cb;
    this.registerAPICallback = registerAPICallback;
  }

  async install_transactions(tx: TxWitness, jobid: string | undefined) {
    console.log("installing transaction into rollup ...");
    transactions_witness.push(tx);
    this.txCallback(tx);
    snapshot = JSON.parse(application.snapshot());
    console.log("transaction installed, rollup pool length is:", transactions_witness.length);
    try {
      const txRecord = new modelTx(tx);
      txRecord.save();
    } catch (e) {
      console.log("fatal: store tx failed ... process will terminate");
    }
    if (application.preempt()) {
      console.log("rollup reach its preemption point, generating proof:");
      let txdata = application.finalize();
      console.log("txdata is:", txdata);
      try {
        if (deploymode) {
          let task_id = await submitProofWithRetry(merkle_root, transactions_witness, txdata);
          console.log("proving task submitted at:", task_id);
          console.log("tracking task in db ...", merkle_root);
          const bundleRecord = new modelBundle({
            merkleRoot: merkleRootToBeHexString(merkle_root),
            taskId: task_id,
          });
          try {
            await bundleRecord.save();
            console.log(`task recorded with key: ${merkleRootToBeHexString(merkle_root)}`);
          } catch (e) {
            let record = await modelBundle.find({
              merkleRoot: merkleRootToBeHexString(merkle_root),
            });
            console.log("fatal: conflict db merkle");
            console.log(record);
            //throw e
          }
        }
        transactions_witness = new Array();
        // need to update merkle_root as the input of next proof
        merkle_root = application.query_root();
        // reset application here
        console.log("restore root:", merkle_root);
        await (initApplication as any)(bootstrap);
        application.initialize(merkle_root);
      } catch (e) {
        console.log(e);
        process.exit(1); // this should never happen and we stop the whole process
      }
    }
    let current_merkle_root = application.query_root();
    console.log("last root:", current_merkle_root);
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
      if (remote) {throw Error("Can't migrate in remote mode");}
      merkle_root = await getMerkleArray();
      console.log("Migrate: updated merkle root", merkle_root);
    }
    //initialize merkle_root based on the latest task
    if (remote) {
      while (true) {
        const hasTasks = await has_uncomplete_task();
        if (hasTasks) {
          console.log("remote = 1, There are uncompleted tasks. Trying again in 5 second...");
          await new Promise(resolve => setTimeout(resolve, 5000)); // Sleep for 5 second
        } else {
          console.log("remote = 1, No incomplete tasks. Proceeding...");
          break; // Exit the loop if there are no incomplete tasks
        }
      }

      let task = await get_latest_proof(taskid);
      console.log("latest taskId got from remote:", task?._id);
      console.log("latest task", task?.instances);
      if (task) {
        const instances = ZkWasmUtil.bytesToBN(task?.instances);
        merkle_root = new BigUint64Array([
          BigInt(instances[4].toString()),
          BigInt(instances[5].toString()),
          BigInt(instances[6].toString()),
          BigInt(instances[7].toString()),
        ]);
        console.log("updated merkle root", merkle_root);
      }
    }

    console.log("initialize sequener queue ...");
    const myQueue = new Queue('sequencer', {connection});

    const waitingCount = await myQueue.getWaitingCount();
    console.log("waiting Count is:", waitingCount, " perform draining ...");
    await myQueue.drain();

    this.queue = myQueue;

    console.log("initialize application merkle db ...");
    application.initialize(merkle_root);

    // update the merkle root variable
    merkle_root = application.query_root();

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


    this.worker = new Worker('sequencer', async job => {
      if (job.name == 'autoJob') {
        console.log("handle auto", job.data);
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
          let signature = sign(new BigUint64Array([0n, seed, rand, 0n]), get_server_admin_key());
          let u64array = signature_to_u64array(signature);
          application.handle_tx(u64array);
          await this.install_transactions(signature, job.id);
        } catch (error) {
          console.log("fatal: handling auto tick error, process will terminate.", error);
          process.exit(1);
        }
      } else if (job.name == 'transaction') {
        console.log("handle transaction ...");
        try {
          let signature = job.data.value;
          let u64array = signature_to_u64array(signature);
          console.log("tx data", signature);
          application.verify_tx_signature(u64array);
          let error = application.handle_tx(u64array);
          if (error == 0) {
            // make sure install transaction will succeed
            await this.install_transactions(signature, job.id);
            try {
              const jobRecord = new modelJob({
                jobId: signature.sigx,
                message: signature.message,
                result: "succeed",
              });
              await jobRecord.save();
            } catch (e) {
              console.log("Error: store transaction job error");
              throw e
            }
          } else {
            let errorMsg = application.decode_error(error);
            throw Error(errorMsg)
          }
          console.log("done");
          const pkx = new LeHexBN(job.data.value.pkx).toU64Array();
          let jstr = application.get_state(pkx);
          let player = JSON.parse(jstr);
          let result = {
            player: player,
            state: snapshot
          };
          return result
        } catch (e) {
          throw e
        }
      }
    }, {connection});
  }

  async serve() {

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
        const msg = new LeHexBN(value.msg);
        const pkx = new LeHexBN(value.pkx);
        const pky = new LeHexBN(value.pky);
        const sigx = new LeHexBN(value.sigx);
        const sigy = new LeHexBN(value.sigy);
        const sigr = new LeHexBN(value.sigr);
        if (verify_sign(msg, pkx, pky, sigx, sigy, sigr) == false) {
          console.error('Invalid signature:');
          res.status(500).send('Invalid signature');
        } else {
          const job = await this.queue!.add('transaction', { value });
          res.status(201).send({
            success: true,
            jobid: job.id
          });
        }
      } catch (error) {
        console.error('Error adding job to the queue:', error);
        res.status(500).send('Failed to add job to the queue');
      }
    });

    app.post('/query', async (req, res) => {
      console.log("receive query command");
      const value = req.body;
      console.log("value is", value);
      if (!value) {
        return res.status(400).send('Value is required');
      }

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
        res.status(201).send({
          success: true,
          data: JSON.stringify(result),
        });

      } catch (error) {
        res.status(500).send('Get Status Error');
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

  app.get('/prooftask/:root', async (req, res) => {
    try {
      let merkleRootString = req.params.root;
      let merkleRoot = new BigUint64Array(hexStringToMerkleRoot(merkleRootString));
      let record = await modelBundle.findOne({ merkleRoot: merkleRoot});
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
  const msg = new LeHexBN(value.msg).toU64Array();
  const pkx = new LeHexBN(value.pkx).toU64Array();
  const pky = new LeHexBN(value.pky).toU64Array();
  const sigx = new LeHexBN(value.sigx).toU64Array();
  const sigy = new LeHexBN(value.sigy).toU64Array();
  const sigr = new LeHexBN(value.sigr).toU64Array();

  let u64array = new BigUint64Array(24);
  u64array.set(msg);
  u64array.set(pkx, 4);
  u64array.set(pky, 8);
  u64array.set(sigx, 12);
  u64array.set(sigy, 16);
  u64array.set(sigr, 20);
  return u64array;
}