import mongoose from 'mongoose';

export const globalBundleSchema = new mongoose.Schema({
  merkleRoot: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  preMerkleRoot: {
    type: String,
    default: '',
    index: true
  },
  postMerkleRoot: {
    type: String, 
    default: '',
    index: true
  },
  
  // ZK task ID
  taskId: {
    type: String,
    default: ''
  },
  
  settleStatus: {
    type: String,
    default: 'waiting'
  },
  settleTxHash: {
    type: String,
    default: ''
  },
  withdrawArray: [{
    address: { type: String, default: '' },
    amount: { type: BigInt, default: '' }
  }],
  
  // MD5 association field
  imageMD5: {
    type: String,
    required: true,
    index: true
  },
  
  bundleIndex: {
    type: Number,
    default: 0
  }
});

globalBundleSchema.index({ imageMD5: 1 });
globalBundleSchema.index({ preMerkleRoot: 1, postMerkleRoot: 1 });
globalBundleSchema.index({ merkleRoot: 1 });
export interface IGlobalBundle extends mongoose.Document {
  merkleRoot: string;
  preMerkleRoot: string;
  postMerkleRoot: string;
  taskId: string;
  settleStatus: string;
  settleTxHash: string;
  withdrawArray: Array<{ address: string; amount: string }>;
  imageMD5: string;
  bundleIndex: number;
}