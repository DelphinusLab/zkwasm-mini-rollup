import mongoose from 'mongoose';
import {ZkWasmServiceHelper} from 'zkwasm-service-helper';
import dotenv from 'dotenv';

export const TRANSACTION_NUMBER = 10; // transactions for each rollup
export const SERVER_PRI_KEY = "1234567";

export const priv = "2763537251e2f27dc6a30179e7bf1747239180f45b92db059456b7da8194995a"
export const endpoint = "https://rpc.zkwasmhub.com:8090";
export const get_image_md5 = () => {
  if (process.env.IMAGE) {
    return process.env.IMAGE
  } else {
    return "77B332087A32A232314C309C5760DA44";
  }
}

export const user_addr = "0xd8f157Cc95Bc40B4F0B58eb48046FebedbF26Bde";
export const contract_addr = "0xf826f771BC12eD8142e631A15fb8E5A61465bC2B";

export const jobSchema = new mongoose.Schema({
    jobId: {
          type: String,
          required: true,
          unique: true,
    },
    message: {
          type: String,
    },

    result: {
          type: String,
          enum: ['succeed', 'failed'],
          default: 'pending',
    },
});

export const bundleSchema = new mongoose.Schema({
    merkleRoot: {
          type: String,
          required: true,
          unique: true,
    },
    taskId: {
          type: String,
          default: '',
    },
});

export const randSchema = new mongoose.Schema({
    commitment: {
          type: String,
          required: true,
          unique: true,
    },
    seed: Buffer,
});



export const modelJob = mongoose.model('Job', jobSchema);
export const modelBundle = mongoose.model('Bundle', bundleSchema);
export const modelRand = mongoose.model('Rand', randSchema);

export const ServiceHelper = new ZkWasmServiceHelper(endpoint, "", "");


