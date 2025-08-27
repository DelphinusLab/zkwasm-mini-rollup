import mongoose, { Model } from 'mongoose';
import { globalBundleSchema, IGlobalBundle } from '../schemas/global-bundle.js';
import { get_mongodb_uri, get_image_md5 } from '../config.js';

export class GlobalBundleService {
  private globalBundleModel: Model<IGlobalBundle>;
  private globalConnection: mongoose.Connection;
  
  constructor() {
    const globalDbUri = `${get_mongodb_uri()}/zkwasm_global_bundles`;
    this.globalConnection = mongoose.createConnection(globalDbUri);
    this.globalBundleModel = this.globalConnection.model<IGlobalBundle>('GlobalBundle', globalBundleSchema);
  }
  
  async getAllUsedMD5s(): Promise<string[]> {
    return await this.globalBundleModel.find().distinct('imageMD5');
  }
  
  async findBundleChain(targetMerkleRoot: string): Promise<IGlobalBundle[]> {
    console.log(`Finding bundle chain for merkleRoot: ${targetMerkleRoot}`);
    
    const bundles: IGlobalBundle[] = [];
    let currentMerkleRoot = targetMerkleRoot;
    
    while (currentMerkleRoot) {
      const bundle = await this.globalBundleModel.findOne({
        merkleRoot: currentMerkleRoot
      });
      
      if (!bundle) break;
      
      bundles.unshift(bundle);
      currentMerkleRoot = bundle.preMerkleRoot;
    }
    
    return bundles;
  }
  
  
  async createBundle(bundleData: Partial<IGlobalBundle>, imageMD5: string): Promise<IGlobalBundle> {
    const bundle = await this.globalBundleModel.create({
      ...bundleData,
      imageMD5: imageMD5
    });
    
    console.log(`Created global bundle: ${bundle.merkleRoot} for MD5: ${imageMD5}`);
    return bundle;
  }
  
  async updateBundle(merkleRoot: string, updateData: Partial<IGlobalBundle>): Promise<IGlobalBundle | null> {
    return await this.globalBundleModel.findOneAndUpdate(
      { merkleRoot: merkleRoot },
      { $set: updateData },
      { new: true }
    );
  }
  
  
  async getLatestBundleForMD5(imageMD5: string): Promise<IGlobalBundle | null> {
    return await this.globalBundleModel.findOne({
      imageMD5: imageMD5
    }).sort({ bundleIndex: -1 });
  }
  
  async findBundleByMerkle(merkleRoot: string): Promise<IGlobalBundle | null> {
    return await this.globalBundleModel.findOne({
      merkleRoot: merkleRoot
    });
  }
  
  async close(): Promise<void> {
    await this.globalConnection.close();
  }
}

