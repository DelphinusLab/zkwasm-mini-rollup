import mongoose from 'mongoose';
import { get_mongodb_uri } from '../config.js';
import { GlobalBundleService } from './global-bundle-service.js';

export class StateMigrationService {
  private globalBundleService: GlobalBundleService;
  
  constructor() {
    this.globalBundleService = new GlobalBundleService();
  }
  
  async migrateDataToMerkleRoot(targetMerkleRoot: string, newMD5: string) {
    console.log(`Migrating business state to merkleRoot: ${targetMerkleRoot}`);
    
    // Verify target Bundle exists
    const bundleChain = await this.globalBundleService.findBundleChain(targetMerkleRoot);
    if (bundleChain.length === 0) {
      throw new Error(`No bundle chain found for merkleRoot: ${targetMerkleRoot}`);
    }
    
    console.log(`Found bundle chain with ${bundleChain.length} bundles`);
    
    // Migrate state snapshot data to specified merkleRoot
    await this.migrateStateSnapshot(targetMerkleRoot, newMD5);
    
    console.log(`Business state migration completed to ${newMD5}`);
    console.log(`Note: Historical records remain in original databases for reference`);
    console.log(`Note: Account cache will rebuild automatically during usage`);
  }
  
  private async migrateStateSnapshot(targetMerkleRoot: string, newMD5: string) {
    console.log(`Migrating state snapshot for merkleRoot: ${targetMerkleRoot}`);
    
    const usedMD5s = await this.globalBundleService.getAllUsedMD5s();
    const targetDbUri = `${get_mongodb_uri()}/${newMD5}_job-tracker`;
    const targetConn = mongoose.createConnection(targetDbUri);
    
    let foundSnapshots = false;
    
    for (const sourceMD5 of usedMD5s) {
      const sourceDbUri = `${get_mongodb_uri()}/${sourceMD5}_job-tracker`;
      const sourceConn = mongoose.createConnection(sourceDbUri);
      
      try {
        // Dynamically detect IndexedObject snapshot collections
        const snapshotCollections = await this.detectSnapshotCollections(sourceConn);
        console.log(`Detected snapshot collections in ${sourceMD5}: ${snapshotCollections.join(', ')}`);
        
        const allSnapshots: Record<string, any[]> = {};
        let hasAnySnapshots = false;
        
        // Find state snapshots for target merkleRoot
        for (const snapshotCollection of snapshotCollections) {
          const snapshots = await sourceConn.collection(snapshotCollection)
            .find({ merkleRoot: targetMerkleRoot }).toArray();
          
          if (snapshots.length > 0) {
            allSnapshots[snapshotCollection] = snapshots;
            hasAnySnapshots = true;
          }
        }
        
        // Event snapshots removed, no need to migrate event data
        
        if (hasAnySnapshots) {
          foundSnapshots = true;
          
          const snapshotCounts = Object.entries(allSnapshots)
            .map(([collection, snapshots]) => `${snapshots.length} ${collection.replace('_snapshots', '')}`)
            .join(', ');
          console.log(`Found snapshots in ${sourceMD5}: ${snapshotCounts}`);
          
          // Restore snapshot data to active state
          for (const [snapshotCollection, snapshots] of Object.entries(allSnapshots)) {
            // All snapshots are IndexedObject snapshots, restore to active state
            const activeCollectionName = snapshotCollection.replace('_snapshots', '');
            
            const activeObjects = snapshots.map(doc => {
              const { merkleRoot, _id, ...activeData } = doc;
              return activeData;
            });
            
            // Restore to active state
            await targetConn.collection(activeCollectionName).insertMany(activeObjects, { ordered: false });
            
            // Also copy snapshot data to maintain versioning capability
            await targetConn.collection(snapshotCollection).insertMany(snapshots, { ordered: false });
          }
        }
        
      } catch (error) {
        console.warn(`Failed to check snapshots in ${sourceMD5}:`, error);
      } finally {
        await sourceConn.close();
      }
    }
    
    await targetConn.close();
    
    if (!foundSnapshots) {
      console.warn(`No state snapshots found for merkleRoot: ${targetMerkleRoot}`);
      console.warn(`This might be expected if this is the genesis state`);
    } else {
      console.log(`State snapshot migration completed for merkleRoot: ${targetMerkleRoot}`);
    }
  }
  
  private snapshotCollectionsCache: Map<string, string[]> = new Map();
  
  private async detectSnapshotCollections(connection: mongoose.Connection): Promise<string[]> {
    const dbName = connection.db.databaseName;
    
    // Use cache to avoid repeated detection
    if (this.snapshotCollectionsCache.has(dbName)) {
      return this.snapshotCollectionsCache.get(dbName)!;
    }
    
    try {
      const collections = await connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      // Find collections ending with _snapshots
      const snapshotCollections = collectionNames.filter(name => 
        name.endsWith('_snapshots')
      );
      
      console.log(`Snapshot collections in ${dbName}: ${snapshotCollections.join(', ')}`);
      
      // Verify IndexedObject snapshot pattern: has merkleRoot + IndexedObject interface
      const verifiedSnapshots: string[] = [];
      
      for (const collectionName of snapshotCollections) {
        try {
          const sampleDoc = await connection.collection(collectionName).findOne({});
          
          // Check if it's IndexedObject snapshot: merkleRoot + {oid, object} pattern
          if (sampleDoc && this.isIndexedObjectSnapshot(sampleDoc)) {
            verifiedSnapshots.push(collectionName);
            console.log(`Verified IndexedObject snapshot: ${collectionName}`);
          }
        } catch (error) {
          console.warn(`Failed to verify snapshot collection ${collectionName}:`, error);
        }
      }
      
      // Cache results
      this.snapshotCollectionsCache.set(dbName, verifiedSnapshots);
      return verifiedSnapshots;
      
    } catch (error) {
      console.warn(`Failed to detect snapshot collections in ${dbName}:`, error);
      this.snapshotCollectionsCache.set(dbName, []);
      return [];
    }
  }
  
  private isIndexedObjectSnapshot(doc: any): boolean {
    return doc.merkleRoot !== undefined && 
           doc.oid !== undefined && 
           doc.object !== undefined;
  }
}