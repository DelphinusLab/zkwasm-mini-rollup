import mongoose from 'mongoose';

export const globalBundleSchema = new mongoose.Schema({
  merkleRoot: {
    type: String,
    required: true,
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
  txdata: {
    type: Buffer,
    default: null
  },
  
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
// Compound unique index: allow same merkleRoot for different MD5s, but prevent duplicates within same MD5
globalBundleSchema.index({ merkleRoot: 1, imageMD5: 1 }, { unique: true });
export interface IGlobalBundle extends mongoose.Document {
  merkleRoot: string;
  preMerkleRoot: string;
  postMerkleRoot: string;
  taskId: string;
  settleStatus: string;
  settleTxHash: string;
  txdata: Buffer | null;
  imageMD5: string;
  bundleIndex: number;
}