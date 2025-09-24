import mongoose from 'mongoose';
import { get_mongodb_uri } from '../config.js';
import { GlobalBundleService } from './global-bundle-service.js';

// System collections that should be excluded from business data operations
const SYSTEM_COLLECTIONS = [
  'bundles', 'commits', 'events', 'jobs', 'rands', 'txes'
];

// The initial/genesis merkle root that has no corresponding bundle
const GENESIS_MERKLE_ROOT = '0xcd3f26ca390619d19789d18e2adabfe68f13f959da813b0327683708583d5ede';

export class StateMigrationService {
  private globalBundleService: GlobalBundleService;
  
  constructor() {
    this.globalBundleService = new GlobalBundleService();
  }
  
  async migrateDataToMerkleRoot(targetMerkleRoot: string, newMD5: string) {
    console.log(`Migrating business state to merkleRoot: ${targetMerkleRoot}`);
    
    // Check if this is the known genesis merkle root
    if (targetMerkleRoot === GENESIS_MERKLE_ROOT) {
      console.log(`Target merkleRoot is the genesis state: ${GENESIS_MERKLE_ROOT}`);
      console.log(`No migration needed - new MD5 database ${newMD5} will start with empty state`);
      return;
    }
    
    // For non-genesis roots, verify target Bundle exists
    const targetBundle = await this.globalBundleService.findBundleByMerkle(targetMerkleRoot);
    if (!targetBundle) {
      throw new Error(`No bundle found for merkleRoot: ${targetMerkleRoot}. This should not happen for non-genesis roots.`);
    }
    
    console.log(`Found target bundle: ${targetMerkleRoot}`);
    
    // Migrate state snapshot data to specified merkleRoot
    await this.migrateStateSnapshot(targetMerkleRoot, newMD5);
    
    console.log(`Business state migration completed to ${newMD5}`);
    console.log(`Note: Historical records remain in original databases for reference`);
    console.log(`Note: Account cache will rebuild automatically during usage`);
  }
  
  private async migrateStateSnapshot(targetMerkleRoot: string, newMD5: string) {
    console.log(`Migrating state snapshot for merkleRoot: ${targetMerkleRoot}`);
    
    // Find the specific MD5 database that contains this merkleRoot
    const targetBundle = await this.globalBundleService.findBundleByMerkle(targetMerkleRoot);
    if (!targetBundle) {
      console.warn(`No bundle found for merkleRoot: ${targetMerkleRoot}`);
      console.warn(`This might be expected if this is the genesis state`);
      return;
    }
    
    const sourceMD5 = targetBundle.imageMD5;
    console.log(`Found merkleRoot ${targetMerkleRoot} in MD5 database: ${sourceMD5}`);
    
    const sourceDbUri = `${get_mongodb_uri()}/${sourceMD5}_job-tracker`;
    const targetDbUri = `${get_mongodb_uri()}/${newMD5}_job-tracker`;
    const sourceConn = mongoose.createConnection(sourceDbUri);
    const targetConn = mongoose.createConnection(targetDbUri);
    
    // Wait for connections to be ready
    await sourceConn.asPromise();
    await targetConn.asPromise();
    
    try {
      // Dynamically detect business snapshot collections
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
      
      if (hasAnySnapshots) {
        const snapshotCounts = Object.entries(allSnapshots)
          .map(([collection, snapshots]) => `${snapshots.length} ${collection.replace('_snapshots', '')}`)
          .join(', ');
        console.log(`Found snapshots in ${sourceMD5}: ${snapshotCounts}`);
        
        // Restore snapshot data to active state
        for (const [snapshotCollection, snapshots] of Object.entries(allSnapshots)) {
          // Restore business snapshots to active state
          const activeCollectionName = snapshotCollection.replace('_snapshots', '');
          
          const activeObjects = snapshots.map(doc => {
            const { merkleRoot, snapshotTimestamp, ...activeData } = doc;
            // Preserve original _id for reference integrity
            return activeData;
          });
          
          // Restore to active state only - no snapshot copying needed
          await targetConn.collection(activeCollectionName).insertMany(activeObjects, { ordered: false });
        }
        
        console.log(`State snapshot migration completed for merkleRoot: ${targetMerkleRoot}`);
        
        // Validate migration results before closing connection
        await this.validateMigrationResults(targetConn, newMD5);
      } else {
        console.warn(`No state snapshots found for merkleRoot: ${targetMerkleRoot} in ${sourceMD5}`);
        console.warn(`This might indicate the snapshot was not created or cleaned up`);
      }
      
    } catch (error) {
      console.error(`Failed to migrate snapshots from ${sourceMD5}:`, error);
      throw error;
    } finally {
      await sourceConn.close();
      await targetConn.close();
    }
  }
  
  private async validateMigrationResults(targetConn: mongoose.Connection, newMD5: string) {
    try {
      await targetConn.asPromise(); // Ensure connection is established
      if (!targetConn.db) {
        throw new Error('Database connection not established');
      }
      const collections = await targetConn.db.listCollections().toArray();
      const businessCollections = collections.filter(c => 
        !c.name.endsWith('_snapshots') && 
        !SYSTEM_COLLECTIONS.includes(c.name)
      );
      
      console.log(`Migration validation for ${newMD5}:`);
      let totalRecords = 0;
      
      for (const collection of businessCollections) {
        const count = await targetConn.collection(collection.name).countDocuments({});
        console.log(`  ${collection.name}: ${count} records`);
        totalRecords += count;
      }
      
      console.log(`Total migrated records: ${totalRecords} across ${businessCollections.length} collections`);
      
      if (businessCollections.length === 0) {
        console.warn(`Warning: No business collections found after migration. This might indicate a problem.`);
      }
      
    } catch (error) {
      console.error('Failed to validate migration results:', error);
    }
  }
  
  private async detectSnapshotCollections(connection: mongoose.Connection): Promise<string[]> {
    
    try {
      await connection.asPromise(); // Ensure connection is established
      if (!connection.db) {
        throw new Error('Database connection not established');
      }
      const collections = await connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      // Find collections ending with _snapshots
      const snapshotCollections = collectionNames.filter(name => 
        name.endsWith('_snapshots')
      );
      
      return snapshotCollections;
      
    } catch (error) {
      console.warn(`Failed to detect snapshot collections:`, error);
      return [];
    }
  }
  
  // Removed - no longer need to verify specific data structure patterns
}