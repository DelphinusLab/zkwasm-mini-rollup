import Redis from 'ioredis';
import { ZkWasmServiceHelper } from "zkwasm-service-helper";
import { TxWitness, submitProof } from '../prover.js';
import { modelBundle } from '../config.js';
import { merkleRootToBeHexString } from '../lib.js';

interface ProofTask {
  id: string;
  merkleRoot: BigUint64Array;
  transactions: TxWitness[];
  txdata: Uint8Array;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  submissionTimestamp?: number;
  realTaskId?: string;
  attempts: number;
  createdAt: number;
}

interface QueryResult {
  taskFound: boolean;
  taskId?: string;
}

export class ProofSubmissionService {
  private redis: Redis;
  private isProcessing: boolean = false;
  private imageMd5: string;
  private helper: ZkWasmServiceHelper;
  
  constructor(redis: Redis, imageMd5: string, helper: ZkWasmServiceHelper) {
    this.redis = redis;
    this.imageMd5 = imageMd5;
    this.helper = helper;
  }
  
  async addTaskToStack(merkleRoot: BigUint64Array, txs: TxWitness[], txdata: Uint8Array): Promise<void> {
    // Validate parameters
    if (!merkleRoot || merkleRoot.length !== 4) {
      throw new Error(`Invalid merkleRoot: ${merkleRoot}`);
    }
    if (!txs || txs.length === 0) {
      throw new Error(`Invalid transactions: empty array`);
    }
    if (!txdata || txdata.length === 0) {
      console.warn(`[ProofService] Warning: empty txdata for merkle ${merkleRootToBeHexString(merkleRoot)}`);
    }
    
    // Validate transaction structure
    for (const tx of txs) {
      if (!tx.pkx || !tx.pky || !tx.msg || !tx.sigx || !tx.sigy || !tx.sigr) {
        throw new Error(`Invalid transaction structure: ${JSON.stringify(tx)}`);
      }
    }
    
    const task: ProofTask = {
      id: this.generateTaskId(),
      merkleRoot,
      transactions: txs,
      txdata,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now()
    };
    
    const stackKey = `proof-task-stack:${this.imageMd5}`;
    const taskKey = `proof-task:${this.imageMd5}:${task.id}`;
    
    await this.redis.rpush(stackKey, task.id);
    await this.redis.hset(taskKey, this.serializeTask(task));
    
    console.log(`[ProofService] Added task ${task.id} to stack for merkle ${merkleRootToBeHexString(merkleRoot)} (${txs.length} txs, ${txdata.length} bytes)`);
    
    if (!this.isProcessing) {
      console.log(`[ProofService] Starting background processing for task ${task.id}`);
      this.processNextTask();
    }
  }
  
  private async processNextTask(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log(`[ProofService] Already processing, skipping duplicate processNextTask call`);
      return;
    }
    
    const stackKey = `proof-task-stack:${this.imageMd5}`;
    const taskId = await this.redis.lindex(stackKey, 0);
    if (!taskId) {
      this.isProcessing = false;
      console.log(`[ProofService] No more tasks to process, stopping background processor`);
      return; // Stop processing loop
    }
    
    this.isProcessing = true;
    const taskKey = `proof-task:${this.imageMd5}:${taskId}`;
    const taskData = await this.redis.hgetall(taskKey);
    if (Object.keys(taskData).length === 0) {
      console.warn(`[ProofService] Task ${taskId} data missing, removing from stack`);
      await this.redis.lpop(stackKey);
      setTimeout(() => this.processNextTask(), 100);
      return;
    }
    
    let task;
    try {
      task = this.deserializeTask(taskData);
    } catch (error) {
      console.error(`[ProofService] Failed to deserialize task ${taskId}:`, error);
      await this.redis.lpop(stackKey);
      setTimeout(() => this.processNextTask(), 100);
      return;
    }
    
    console.log(`[ProofService] Processing task ${task.id} (merkle: ${merkleRootToBeHexString(task.merkleRoot)})`);
    await this.processCurrentTask(task, stackKey);
    
    // If we reach here, the task was completed successfully and removed from stack
    console.log(`[ProofService] Task ${task.id} completed successfully, processing next task`);
    setTimeout(() => this.processNextTask(), 100);
  }
  
  private async processCurrentTask(task: ProofTask, stackKey: string): Promise<boolean> {
    const MAX_NON_TIMEOUT_ATTEMPTS = 3;
    let nonTimeoutAttempts = 0;
    
    // Check merkle continuity with previous completed task
    await this.validateMerkleContinuity(task);
    
    console.log(`[ProofService] Processing task ${task.id} with validated merkle continuity`);
    
    if (task.submissionTimestamp) {
      console.log(`Resuming task ${task.id} from previous submission, entering query mode...`);
      const queryResult = await this.queryUntilConfirmed(task);
      
      if (queryResult.taskFound) {
        task.realTaskId = queryResult.taskId;
        task.status = 'confirmed';
        await this.updateBundleTaskId(task.merkleRoot, queryResult.taskId!);
        await this.redis.lpop(stackKey);
        await this.removeTaskFromRedis(task.id);
        return true;
      }
      
      console.log(`Resumed task ${task.id} confirmed not submitted, will resubmit`);
    }
    
    while (true) {
      try {
        console.log(`[ProofService] Submitting proof for task ${task.id}...`);
        task.submissionTimestamp = Date.now();
        const taskId = await submitProof(task.merkleRoot, task.transactions, task.txdata);
        
        console.log(`[ProofService] Proof submission successful for task ${task.id}, got taskId: ${taskId}`);
        task.realTaskId = taskId;
        task.status = 'confirmed';
        await this.updateBundleTaskId(task.merkleRoot, taskId);
        await this.redis.lpop(stackKey);
        await this.removeTaskFromRedis(task.id);
        
        return true;
        
      } catch (error: any) {
        console.log(`Task ${task.id} failed with error: ${error.message}, entering query confirmation mode...`);
        
        const queryResult = await this.queryUntilConfirmed(task);
        
        if (queryResult.taskFound) {
          task.realTaskId = queryResult.taskId;
          task.status = 'confirmed';
          await this.updateBundleTaskId(task.merkleRoot, queryResult.taskId!);
          await this.redis.lpop(stackKey);
          await this.removeTaskFromRedis(task.id);
          return true;
        }
        
        console.log(`Task ${task.id} confirmed not submitted, proceeding with retry logic...`);
        
        if (error.message === "Timeout exceeded") {
          console.log(`Task ${task.id} was timeout error, retrying immediately...`);
          continue;
        } else {
          nonTimeoutAttempts++;
          console.log(`[ProofService] Task ${task.id} failed with non-timeout error (attempt ${nonTimeoutAttempts}/${MAX_NON_TIMEOUT_ATTEMPTS}):`, error);
          
          if (nonTimeoutAttempts >= MAX_NON_TIMEOUT_ATTEMPTS) {
            task.status = 'failed';
            console.error(`[ProofService] Task ${task.id} failed after ${MAX_NON_TIMEOUT_ATTEMPTS} non-timeout attempts`);
            console.error("[ProofService] Fatal: proof submission consistently failing, terminating service");
            process.exit(1);
          }
          
          console.log(`[ProofService] Waiting 30s before retry for task ${task.id}`);
          await this.wait(30000);
          continue;
        }
      }
    }
  }
  
  private async queryUntilConfirmed(task: ProofTask): Promise<QueryResult> {
    const MAX_QUERY_DURATION = 3 * 60 * 1000; // Reduced to 3 minutes
    const QUERY_INTERVAL = 15000;
    const MAX_CONSECUTIVE_FAILURES = 3; // Exit early after 3 consecutive empty results
    const startTime = Date.now();
    let consecutiveEmptyResults = 0;
    
    while (Date.now() - startTime < MAX_QUERY_DURATION) {
      try {
        const recentTasks = await this.helper.loadTaskList({
          md5: this.imageMd5,
          user_address: null,
          id: null,
          tasktype: "Prove",
          taskstatus: "",
          total: 30
        });
        
        // If no tasks returned, increment empty result counter
        if (!recentTasks.data || recentTasks.data.length === 0) {
          consecutiveEmptyResults++;
          console.log(`No tasks returned (${consecutiveEmptyResults}/${MAX_CONSECUTIVE_FAILURES})`);
          
          if (consecutiveEmptyResults >= MAX_CONSECUTIVE_FAILURES) {
            console.log(`Exiting early: ${MAX_CONSECUTIVE_FAILURES} consecutive empty results`);
            return { taskFound: false };
          }
        } else {
          consecutiveEmptyResults = 0; // Reset counter when we get results
        }
        
        const expectedInputs = [task.merkleRoot[0], task.merkleRoot[1], task.merkleRoot[2], task.merkleRoot[3]]
          .map(x => `${x}:i64`);
        
        const matchingTask = recentTasks.data.find((t: any) => {
          return t.public_inputs && 
                 t.public_inputs.length >= 4 &&
                 t.public_inputs[0] === expectedInputs[0] &&
                 t.public_inputs[1] === expectedInputs[1] &&
                 t.public_inputs[2] === expectedInputs[2] &&
                 t.public_inputs[3] === expectedInputs[3];
        });
        
        if (matchingTask) {
          return { taskFound: true, taskId: matchingTask._id.toString() };
        }
        
        console.log(`No matching task found, will retry after ${QUERY_INTERVAL}ms...`);
        
      } catch (error: any) {
        console.log("Query failed, retrying:", error);
        consecutiveEmptyResults++; // Treat query failures as empty results
      }
      
      await this.wait(QUERY_INTERVAL);
    }
    
    return { taskFound: false };
  }
  
  private async updateBundleTaskId(merkleRoot: BigUint64Array, realTaskId: string): Promise<void> {
    const merkleRootStr = merkleRootToBeHexString(merkleRoot);
    await modelBundle.findOneAndUpdate(
      { merkleRoot: merkleRootStr, taskId: null },
      { taskId: realTaskId }
    );
  }
  
  private async removeTaskFromRedis(taskId: string): Promise<void> {
    const taskKey = `proof-task:${this.imageMd5}:${taskId}`;
    await this.redis.del(taskKey);
  }
  
  async recoverTasks(): Promise<void> {
    const stackKey = `proof-task-stack:${this.imageMd5}`;
    const topTaskId = await this.redis.lindex(stackKey, 0);
    
    if (!topTaskId) {
      console.log(`No tasks to recover for image ${this.imageMd5}`);
      return;
    }
    
    const taskKey = `proof-task:${this.imageMd5}:${topTaskId}`;
    const taskData = await this.redis.hgetall(taskKey);
    if (Object.keys(taskData).length === 0) return;
    
    const task = this.deserializeTask(taskData);
    console.log(`Recovering top task ${task.id}`);
    
    console.log(`Top task ${task.id} - checking remote status first`);
    const queryResult = await this.queryUntilConfirmed(task);
    
    if (queryResult.taskFound) {
      task.realTaskId = queryResult.taskId;
      task.status = 'confirmed';
      await this.updateBundleTaskId(task.merkleRoot, queryResult.taskId!);
      await this.redis.lpop(stackKey);
      await this.removeTaskFromRedis(task.id);
      console.log(`Top task ${task.id} found remotely and completed`);
    } else {
      console.log(`Top task ${task.id} not found remotely, will be processed normally`);
    }
    
    if (!this.isProcessing) {
      this.processNextTask();
    }
  }
  
  async queryBundleRemotely(merkleRootStr: string): Promise<QueryResult> {
    const merkleRoot = new BigUint64Array(merkleRootStr.replace('0x', '').match(/.{16}/g)!.map(x => BigInt('0x' + x)));
    const expectedInputs = [merkleRoot[0], merkleRoot[1], merkleRoot[2], merkleRoot[3]].map(x => `${x}:i64`);
    
    const recentTasks = await this.helper.loadTaskList({
      md5: this.imageMd5,
      user_address: null,
      id: null,
      tasktype: "Prove",
      taskstatus: "",
      total: 50
    });
    
    const matchingTask = recentTasks.data.find((t: any) => {
      return t.public_inputs && 
             t.public_inputs.length >= 4 &&
             t.public_inputs[0] === expectedInputs[0] &&
             t.public_inputs[1] === expectedInputs[1] &&
             t.public_inputs[2] === expectedInputs[2] &&
             t.public_inputs[3] === expectedInputs[3];
    });
    
    return matchingTask ? { taskFound: true, taskId: matchingTask._id.toString() } : { taskFound: false };
  }

  async checkRedisTaskExists(merkleRoot: string): Promise<boolean> {
    const stackKey = `proof-task-stack:${this.imageMd5}`;
    const taskIds = await this.redis.lrange(stackKey, 0, -1);
    
    for (const taskId of taskIds) {
      const taskKey = `proof-task:${this.imageMd5}:${taskId}`;
      const taskData = await this.redis.hgetall(taskKey);
      if (Object.keys(taskData).length === 0) continue;
      
      const task = this.deserializeTask(taskData);
      const taskMerkleStr = merkleRootToBeHexString(task.merkleRoot);
      if (taskMerkleStr === merkleRoot) {
        return true;
      }
    }
    
    return false;
  }
  
  private async validateMerkleContinuity(currentTask: ProofTask): Promise<void> {
    // All tasks should connect to the most recent completed bundle
    // since completed tasks are removed from Redis queue
    const lastCompletedBundle = await modelBundle.findOne({ 
      postMerkleRoot: { $nin: [null, ""] }
    }).sort({ _id: -1 });
    
    if (!lastCompletedBundle) {
      console.log(`[ProofService] No previous completed bundle, assuming this is the first task`);
      return;
    }
    
    // Check continuity: last completed bundle's postMerkleRoot == current task's merkleRoot
    const prevEndingMerkleStr = lastCompletedBundle.postMerkleRoot;
    const currentStartingMerkleStr = merkleRootToBeHexString(currentTask.merkleRoot);
    
    console.log(`[ProofService] Merkle continuity check for task ${currentTask.id}`);
    console.log(`[ProofService] Last completed bundle ending merkle: ${prevEndingMerkleStr}`);
    console.log(`[ProofService] Current task starting merkle: ${currentStartingMerkleStr}`);
    
    if (prevEndingMerkleStr !== currentStartingMerkleStr) {
      const error = `Merkle continuity broken! Last completed bundle ending: ${prevEndingMerkleStr} != Current task starting: ${currentStartingMerkleStr}`;
      console.error(`[ProofService] ${error}`);
      throw new Error(error);
    }
    
    console.log(`[ProofService] ✓ Merkle continuity validated for task ${currentTask.id}`);
  }
  
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private serializeTask(task: ProofTask): Record<string, string> {
    return {
      id: task.id,
      merkleRoot: JSON.stringify(Array.from(task.merkleRoot).map((x: bigint) => x.toString())),
      transactions: JSON.stringify(task.transactions),
      txdata: JSON.stringify(Array.from(task.txdata)),
      status: task.status,
      realTaskId: task.realTaskId || '',
      submissionTimestamp: task.submissionTimestamp?.toString() || '',
      attempts: task.attempts.toString(),
      createdAt: task.createdAt.toString()
    };
  }
  
  private deserializeTask(data: Record<string, string>): ProofTask {
    return {
      id: data.id,
      merkleRoot: new BigUint64Array(JSON.parse(data.merkleRoot).map((x: string) => BigInt(x))),
      transactions: JSON.parse(data.transactions),
      txdata: new Uint8Array(JSON.parse(data.txdata)),
      status: data.status as ProofTask['status'],
      realTaskId: data.realTaskId && data.realTaskId !== '' ? data.realTaskId : undefined,
      submissionTimestamp: data.submissionTimestamp && data.submissionTimestamp !== '' ? parseInt(data.submissionTimestamp) : undefined,
      attempts: parseInt(data.attempts),
      createdAt: parseInt(data.createdAt)
    };
  }
}

export async function handleNullTaskIdBundles(proofService: ProofSubmissionService): Promise<void> {
  const nullBundles = await modelBundle.find({ taskId: null });
  
  for (const bundle of nullBundles) {
    const hasRedisTask = await proofService.checkRedisTaskExists(bundle.merkleRoot);
    
    if (!hasRedisTask) {
      console.warn(`[Recovery] Bundle ${bundle.merkleRoot} has no Redis task, checking remote confirmation...`);
      
      // Try to find the task remotely and update Bundle  
      try {
        const queryResult = await proofService.queryBundleRemotely(bundle.merkleRoot);
        if (queryResult.taskFound) {
          console.log(`[Recovery] Found remote task ${queryResult.taskId} for Bundle ${bundle.merkleRoot}`);
          await modelBundle.findOneAndUpdate(
            { merkleRoot: bundle.merkleRoot, taskId: null },
            { taskId: queryResult.taskId }
          );
        } else {
          console.error(`[Recovery] No remote task found for Bundle ${bundle.merkleRoot} - data may be corrupted`);
        }
      } catch (error) {
        console.error(`[Recovery] Failed to query remote for Bundle ${bundle.merkleRoot}:`, error);
      }
    }
  }
}