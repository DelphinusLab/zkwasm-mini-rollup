import { workerData } from 'worker_threads';
import mongoose from 'mongoose';
import { TxStateManager } from './commit.js';
import { get_mongoose_db } from './config.js';
import { hexStringToMerkleRoot, merkleRootToBeHexString } from './lib.js';

let txManager: TxStateManager;
let currentTrackingMerkle: BigUint64Array;

// Initialize MongoDB connection
async function initialize() {
  try {
    await mongoose.connect(get_mongoose_db());
    console.log('[ProofWorker] Connected to MongoDB');
    
    // Initialize from worker data - start from initial merkle
    currentTrackingMerkle = new BigUint64Array(workerData.initialMerkle);
    txManager = new TxStateManager(merkleRootToBeHexString(currentTrackingMerkle));
    
    console.log('[ProofWorker] Starting proof tracking from:', merkleRootToBeHexString(currentTrackingMerkle));
    
    // Start the proof tracking interval
    startProofTracking();
  } catch (error) {
    console.error('[ProofWorker] Initialization failed:', error);
    process.exit(1);
  }
}

function startProofTracking() {
  setInterval(async () => {
    try {
      console.log('[ProofWorker] Tracking unproved bundles from:', merkleRootToBeHexString(currentTrackingMerkle));
      
      const tracked = await txManager.trackUnprovedBundle(currentTrackingMerkle);
      
      if (tracked != null) {
        // Move tracking pointer forward
        currentTrackingMerkle = tracked;
        console.log('[ProofWorker] Advanced tracking to:', merkleRootToBeHexString(tracked));
      } else {
        console.log('[ProofWorker] No advancement needed - continuing from same merkle');
      }
    } catch (error) {
      console.error('[ProofWorker] Proof tracking error:', error);
    }
  }, 30000); // 30 seconds
}

// Initialize the worker
initialize();