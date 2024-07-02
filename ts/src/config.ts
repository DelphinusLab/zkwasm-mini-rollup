import mongoose from 'mongoose';
import {ZkWasmServiceHelper} from 'zkwasm-service-helper';
export const TRANSACTION_NUMBER = 10; // transactions for each rollup
export const SERVER_PRI_KEY = "1234567";

export const priv = "2763537251e2f27dc6a30179e7bf1747239180f45b92db059456b7da8194995a"
export const endpoint = "https://rpc.zkwasmhub.com:8090";
export const image_md5 = "1E183097C2427C41C3F1FEF4E55168DB";
export const user_addr = "0xd8f157Cc95Bc40B4F0B58eb48046FebedbF26Bde";
export const contract_addr = "0x3Bf9Fe92c854E4D48Ab5e3866AE8635BecB40862";

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
          type: Array<bigint>(4),
          required: true,
          unique: true,
    },
    taskId: {
          type: String,
          default: '',
    },
});

export const modelJob = mongoose.model('Job', jobSchema);
export const modelBundle = mongoose.model('Bundle', bundleSchema);

export const ServiceHelper = new ZkWasmServiceHelper(endpoint, "", "");


