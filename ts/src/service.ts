//import initHostBind, * as hostbind from "./wasmbind/hostbind.js";
import initBootstrap, * as bootstrap from "./bootstrap/bootstrap.js";
import initApplication, * as application from "./application/application.js";
import { test_merkle_db_service } from "./test.js";
import { verify_sign, LeHexBN, sign } from "./sign.js";
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import express from 'express';
import { submitProofWithRetry, TxWitness, get_latest_proof } from "./prover.js";
import cors from "cors";
import { TRANSACTION_NUMBER, SERVER_PRI_KEY, modelBundle, modelJob, modelRand } from "./config.js";
import { getMerkleArray } from "./settle.js";
import { ZkWasmUtil } from "zkwasm-service-helper";
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {merkleRootToBeHexString} from "./lib.js";
import {sha256} from "ethers";

// Load environment variables from .env file
dotenv.config();

let deploymode = false;
let remote = false;
let migrate = false;
let mongodbUri = "mongodb://localhost";
let redisHost ;

if (process.env.DEPLOY) {
  deploymode = true;
}

if (process.env.REMOTE) {
  remote = true;
}

if (process.env.MIGRATE) {
  migrate = true;
}

if (process.env.URI) {
  mongodbUri = process.env.URI; //"mongodb:27017";
}

const args = process.argv.slice(2);

const host = (() => {
  if (args.length > 0) {
    return args[0];
  } else {
    return 'localhost'
  }
})();

redisHost = host;
if (process.env.REDISHOST) {
  redisHost = process.env.REDISHOST;
}

let imageMD5Prefix = process.env.IMAGE || "";
mongoose.connect(`${mongodbUri}/${imageMD5Prefix}_job-tracker`, {
    //useNewUrlParser: true,
    //useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});


console.log("redis server:", redisHost);

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
  console.log("redis disconnected unexpected ...");
});

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

async function install_transactions(tx: TxWitness, jobid: string | undefined) {
  console.log("installing transaction into rollup ...");
  transactions_witness.push(tx);
  snapshot = JSON.parse(application.snapshot());
  console.log("transaction installed, rollup pool length is:", transactions_witness.length);
  if (application.preempt()) {
  //if (transactions_witness.length == TRANSACTION_NUMBER) {
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

async function track_error_transactions(tx: TxWitness, jobid: string | undefined) {
  throw Error("Transaction Inverted");
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

async function main() {
  console.log("bootstraping ...");
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
    let task = await get_latest_proof();
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


  const worker = new Worker('sequencer', async job => {
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
        let signature = sign(new BigUint64Array([0n, seed, rand, 0n]), SERVER_PRI_KEY);
        let u64array = signature_to_u64array(signature);
        application.handle_tx(u64array);
        await install_transactions(signature, job.id);
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
          const jobRecord = new modelJob({
                jobId: signature.sigx,
                message: signature.message,
                result: "succeed",
              });
          await jobRecord.save();
          await install_transactions(signature, job.id);
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


  console.log("start express server");
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  app.post('/test', async (req, res) => {
    const value = req.body;
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
        res.status(201).send({
          success: true,
        });
      }
    } catch (error) {
      console.error('Testing signature error:', error);
      res.status(500).send('Testing signature error');
    }
  });

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
        const job = await myQueue.add('transaction', { value });
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
      const job = await Job.fromId(myQueue, jobId);
      return res.status(201).json(job);
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

  // Start the server
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

main();
