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
  
  async getAllBundlesForMD5(imageMD5: string): Promise<IGlobalBundle[]> {
    return await this.globalBundleModel.find({
      imageMD5: imageMD5
    }).sort({ bundleIndex: 1 });
  }
  
  async findBundleByMerkle(merkleRoot: string, imageMD5?: string): Promise<IGlobalBundle | null> {
    const query: any = { merkleRoot: merkleRoot };
    if (imageMD5) {
      query.imageMD5 = imageMD5;
    }
    return await this.globalBundleModel.findOne(query);
  }
  
  async getBundleChain(merkleRootStr: string, maxLength: number = 20, imageMD5?: string): Promise<IGlobalBundle[]> {
    const bundles: IGlobalBundle[] = [];

    // Find starting bundle
    let bundle = await this.findBundleByMerkle(merkleRootStr, imageMD5);
    if (!bundle) {
      return bundles;
    }

    const after = bundle;

    // Go backwards first (up to half maxLength)
    const backwardLimit = Math.floor(maxLength / 2);
    while (bundle != null && bundles.length < backwardLimit) {
      bundles.unshift(bundle);
      bundle = bundle.preMerkleRoot ?
        await this.findBundleByMerkle(bundle.preMerkleRoot, imageMD5) :
        null;
    }

    // Go forwards from the starting point
    bundle = after;
    const len = bundles.length;
    if (bundle) {
      bundle = bundle.postMerkleRoot ?
        await this.findBundleByMerkle(bundle.postMerkleRoot, imageMD5) :
        null;
    }

    while (bundle != null && bundles.length < len + (maxLength - backwardLimit)) {
      bundles.push(bundle);
      bundle = bundle.postMerkleRoot ?
        await this.findBundleByMerkle(bundle.postMerkleRoot, imageMD5) :
        null;
    }

    return bundles;
  }
  
  async close(): Promise<void> {
    await this.globalConnection.close();
  }
}

