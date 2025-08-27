import mongoose from 'mongoose';

export class StateSnapshotService {
  private currentMerkleRoot: string;
  private static readonly MAX_SNAPSHOTS = 100;
  
  constructor(merkleRoot: string) {
    this.currentMerkleRoot = merkleRoot;
  }
  
  async createCompleteSnapshot() {
    console.log(`Creating state snapshot for merkleRoot: ${this.currentMerkleRoot}`);
    
    // Dynamically detect all IndexedObject collections
    const indexedObjectCollections = await this.detectIndexedObjectCollections();
    console.log(`Detected IndexedObject collections: ${indexedObjectCollections.join(', ')}`);
    
    // Create snapshots for all detected collections
    const snapshotTasks = indexedObjectCollections.map(collectionName => 
      this.createSnapshotForCollection(collectionName)
    );
    
    await Promise.all(snapshotTasks);
    
    // Cleanup excessive snapshots after creation
    await this.cleanupExcessiveSnapshots()
  }
  
  private indexedObjectCollectionsCache: string[] | null = null;
  
  private async detectIndexedObjectCollections(): Promise<string[]> {
    // Use cache to avoid repeated detection
    if (this.indexedObjectCollectionsCache !== null) {
      return this.indexedObjectCollectionsCache;
    }
    
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      // Exclude system collections and snapshot collections
      const systemCollections = [
        'accounts', 'bundles', 'commits', 'events', 'jobs', 'rands', 'txes',
        ...collectionNames.filter(name => name.endsWith('_snapshots'))
      ];
      
      const candidateCollections = collectionNames.filter(name => 
        !systemCollections.includes(name)
      );
      
      console.log(`Candidate IndexedObject collections: ${candidateCollections.join(', ')}`);
      
      // Verify if it matches IndexedObject interface: {oid: bigint, object: O}
      const indexedObjectCollections: string[] = [];
      
      for (const collectionName of candidateCollections) {
        try {
          const sampleDoc = await mongoose.connection.collection(collectionName).findOne({});
          
          // Check if it matches IndexedObject interface pattern
          if (sampleDoc && this.hasIndexedObjectInterface(sampleDoc)) {
            indexedObjectCollections.push(collectionName);
            console.log(`Confirmed IndexedObject collection: ${collectionName}`);
          }
        } catch (error) {
          console.warn(`Failed to check collection ${collectionName}:`, error);
        }
      }
      
      // Cache results
      this.indexedObjectCollectionsCache = indexedObjectCollections;
      return indexedObjectCollections;
      
    } catch (error) {
      console.warn(`Failed to detect IndexedObject collections:`, error);
      this.indexedObjectCollectionsCache = [];
      return [];
    }
  }
  
  private hasIndexedObjectInterface(doc: any): boolean {
    return doc.oid !== undefined && doc.object !== undefined;
  }
  
  private async createSnapshotForCollection(collectionName: string) {
    try {
      // Get current active objects directly from MongoDB
      const activeObjects = await mongoose.connection.collection(collectionName).find({}).toArray();
      
      if (activeObjects.length === 0) {
        console.log(`No active objects found for ${collectionName}`);
        return;
      }
      
      // Create snapshot copies for current state
      const snapshots = activeObjects.map(obj => ({
        ...obj,
        merkleRoot: this.currentMerkleRoot,
        _id: undefined
      }));
      
      // Batch insert snapshot data using MongoDB native operations
      await mongoose.connection.collection(`${collectionName}_snapshots`).insertMany(snapshots, { ordered: false });
      console.log(`Created ${snapshots.length} snapshots for ${collectionName}`);
      
    } catch (error) {
      console.warn(`Failed to create snapshots for ${collectionName}:`, error);
    }
  }
  
  private async cleanupExcessiveSnapshots() {
    const indexedObjectCollections = await this.detectIndexedObjectCollections();
    
    for (const collectionName of indexedObjectCollections) {
      const snapshotCollectionName = `${collectionName}_snapshots`;
      
      try {
        // Get all snapshots grouped by merkleRoot
        const allSnapshots = await mongoose.connection.collection(snapshotCollectionName)
          .aggregate([
            { $group: { _id: "$merkleRoot", count: { $sum: 1 }, firstDoc: { $first: "$$ROOT" } } },
            { $sort: { "firstDoc._id": -1 } }
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

