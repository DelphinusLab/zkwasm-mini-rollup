import mongoose from 'mongoose';

// System collections that should be excluded from snapshots
const SYSTEM_COLLECTIONS = [
  'accounts', 'bundles', 'commits', 'events', 'jobs', 'rands', 'txes'
];

export class StateSnapshotService {
  private currentMerkleRoot: string;
  private static readonly MAX_SNAPSHOTS = 100;
  
  constructor(merkleRoot: string) {
    this.currentMerkleRoot = merkleRoot;
  }
  
  async createCompleteSnapshot() {
    console.log(`Creating state snapshot for merkleRoot: ${this.currentMerkleRoot}`);
    
    // Use setImmediate to ensure snapshot creation doesn't block the main event loop
    return new Promise<void>((resolve, reject) => {
      setImmediate(async () => {
        try {
          await this.performSnapshotCreation();
          resolve();
        } catch (error) {
          console.error(`Failed to create complete snapshot for ${this.currentMerkleRoot}:`, error);
          reject(error);
        }
      });
    });
  }
  
  private async performSnapshotCreation() {
    // Dynamically detect all business collections
    const businessCollections = await this.detectBusinessCollections();
    console.log(`Detected business collections: ${businessCollections.join(', ')}`);
    
    if (businessCollections.length === 0) {
      console.log(`No business collections found, snapshot creation skipped for merkleRoot: ${this.currentMerkleRoot}`);
      return;
    }
    
    // Create snapshots for all detected collections with individual error handling
    const snapshotTasks = businessCollections.map(collectionName => 
      this.createSnapshotForCollection(collectionName)
    );
    
    const results = await Promise.allSettled(snapshotTasks);
    
    // Analyze results
    const failed: string[] = [];
    const succeeded: string[] = [];
    
    results.forEach((result, index) => {
      const collectionName = businessCollections[index];
      if (result.status === 'rejected') {
        failed.push(collectionName);
        console.error(`Snapshot failed for ${collectionName}:`, result.reason);
      } else {
        succeeded.push(collectionName);
      }
    });
    
    if (failed.length > 0) {
      console.warn(`Snapshot creation partially failed: ${failed.length}/${businessCollections.length} collections failed`);
      console.warn(`Failed collections: ${failed.join(', ')}`);
      console.log(`Succeeded collections: ${succeeded.join(', ')}`);
      // Continue with cleanup even if some snapshots failed
    } else {
      console.log(`Snapshot creation successful for all ${succeeded.length} collections`);
    }
    
    // Cleanup excessive snapshots after creation
    await this.cleanupExcessiveSnapshots(businessCollections);
  }
  
  private async detectBusinessCollections(): Promise<string[]> {
    
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      // Use predefined system collections list
      
      // Business collections = all collections - system collections - existing snapshots
      const businessCollections = collectionNames.filter(name => 
        !SYSTEM_COLLECTIONS.includes(name) &&
        !name.endsWith('_snapshots')
      );
      
      return businessCollections;
      
    } catch (error) {
      console.warn(`Failed to detect business collections:`, error);
      return [];
    }
  }
  
  private async createSnapshotForCollection(collectionName: string) {
    try {
      // Get current active objects directly from MongoDB
      const activeObjects = await mongoose.connection.collection(collectionName).find({}).toArray();
      
      if (activeObjects.length === 0) {
        console.log(`No active objects found for ${collectionName}`);
        return;
      }
      
      // Create snapshot copies for current state with timestamp
      const snapshots = activeObjects.map(obj => ({
        ...obj,
        merkleRoot: this.currentMerkleRoot,
        snapshotTimestamp: new Date(),
        _id: undefined
      }));
      
      // Batch insert snapshot data using MongoDB native operations
      await mongoose.connection.collection(`${collectionName}_snapshots`).insertMany(snapshots, { ordered: false });
      console.log(`Created ${snapshots.length} snapshots for ${collectionName}`);
      
    } catch (error) {
      console.warn(`Failed to create snapshots for ${collectionName}:`, error);
    }
  }
  
  private async cleanupExcessiveSnapshots(businessCollections: string[]) {
    
    for (const collectionName of businessCollections) {
      const snapshotCollectionName = `${collectionName}_snapshots`;
      
      try {
        // Get all snapshots grouped by merkleRoot, sorted by timestamp
        const allSnapshots = await mongoose.connection.collection(snapshotCollectionName)
          .aggregate([
            { 
              $group: { 
                _id: "$merkleRoot", 
                count: { $sum: 1 }, 
                latestTimestamp: { $max: "$snapshotTimestamp" }
              } 
            },
            { $sort: { "latestTimestamp": -1 } } // Sort by actual timestamp, newest first
          ]).toArray();
        
        if (allSnapshots.length > StateSnapshotService.MAX_SNAPSHOTS) {
          // Get merkleRoot list of old snapshots to delete
          const excessSnapshots = allSnapshots.slice(StateSnapshotService.MAX_SNAPSHOTS);
          const merkleRootsToDelete = excessSnapshots.map(s => s._id);
          
          // Delete excessive snapshots
          const deleteResult = await mongoose.connection.collection(snapshotCollectionName)
            .deleteMany({ merkleRoot: { $in: merkleRootsToDelete } });
          
          console.log(`Cleaned up ${deleteResult.deletedCount} excessive snapshots from ${snapshotCollectionName}`);
        }
      } catch (error) {
        console.warn(`Failed to cleanup excessive snapshots for ${snapshotCollectionName}:`, error);
      }
    }
  }
  
  
  
  updateMerkleRoot(newMerkleRoot: string) {
    this.currentMerkleRoot = newMerkleRoot;
  }
}

