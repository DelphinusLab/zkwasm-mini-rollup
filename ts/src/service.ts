//import initHostBind, * as hostbind from "./wasmbind/hostbind.js";
import initBootstrap, * as bootstrap from "./bootstrap/bootstrap.js";
import initApplication, * as application from "./application/application.js";
import { Queue } from 'bullmq';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import express from 'express';
console.log("abc");

const connection = new IORedis(
    {
        host: 'localhost',  // Your Redis server host
        port: 6379,        // Your Redis server port
        maxRetriesPerRequest: null  // Important: set this to null
    }
);

const commands = new BigUint64Array();

async function main() {
   console.log("bootstraping ...");
   console.log(initBootstrap);
   await (initBootstrap as any)();
   console.log(bootstrap);
   console.log("host binder initialized ...");
   await (initApplication as any)(bootstrap);
   application.test_merkle();
}

main();


const myQueue = new Queue('sequencer', {connection});

// Automatically add a job to the queue every few seconds
setInterval(async () => {
  try {
    const job = await myQueue.add('autoJob', {command:1});
  } catch (error) {
    console.error('Error adding automatic job to the queue:', error);
  }
}, 5000); // Change the interval as needed (e.g., 5000ms for every 5 seconds)


console.log("start worker ...");

const worker = new Worker('sequencer', async job => {
  console.log(job.data);
}, {connection});


const app = express();
const PORT = 3000;

app.use(express.json());
app.post('/send', async (req, res) => {
  const { value } = req.body;

  if (!value) {
    return res.status(400).send('Value is required');
  }

  try {
    const job = await myQueue.add('send', { value });
    res.status(201).send(`Job ${job.id} added to the queue`);
  } catch (error) {
    console.error('Error adding job to the queue:', error);
    res.status(500).send('Failed to add job to the queue');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

