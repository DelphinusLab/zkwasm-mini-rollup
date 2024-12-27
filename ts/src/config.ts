import mongoose from 'mongoose';
import { ZkWasmServiceHelper } from 'zkwasm-service-helper';
import { PrivateKey } from "delphinus-curves/src/altjubjub";
import dotenv from 'dotenv';

dotenv.config();


export const endpoint = "https://rpc.zkwasmhub.com:8090";

export const get_server_admin_key = () => {
  if (process.env.SERVER_ADMIN_KEY) {
    return process.env.SERVER_ADMIN_KEY;
  } else {
    return "1234567"; // server admin private key
  }
}

export const get_server_admin_pubkey = () => {
  let prikey = PrivateKey.fromString(get_server_admin_key());
  let pubkey = prikey.publicKey.key.x.v;
  return pubkey
}

export const get_mongodb_uri = () => {
  if (process.env.URI) {
    return process.env.URI;
  } else {
    return "mongodb://localhost";
  }
}

export const get_mongoose_db = () => {
  let mongodbUri = get_mongodb_uri();
  let imageMD5Prefix = get_image_md5();
  return `${mongodbUri}/${imageMD5Prefix}_job-tracker`
}

export const get_service_port = () => {
  if (process.env.PORT) {
    return process.env.PORT;
  } else {
    return 3000;
  }
}

export const get_image_md5 = () => {
  if (process.env.IMAGE) {
    return process.env.IMAGE;
  } else {
    return "unspecified";
  }
}

export const get_contract_addr = () => {
  if (process.env.SETTLEMENT_CONTRACT_ADDRESS) {
    return process.env.SETTLEMENT_CONTRACT_ADDRESS;
  } else {
    return "0x73E717cf6288A657e1a881742aD0BA50fcf846Ba";
  }
}

export const get_user_addr = () => {
  if (process.env.USER_ADDRESS) {
    return process.env.USER_ADDRESS;
  } else {
    return "0xd8f157Cc95Bc40B4F0B58eb48046FebedbF26Bde";
  }
}

export const get_user_private_account = () => {
  if (process.env.USER_PRIVATE_ACCOUNT) {
    return process.env.USER_PRIVATE_ACCOUNT;
  } else {
    return "2763537251e2f27dc6a30179e7bf1747239180f45b92db059456b7da8194995a";
  }
}

export const get_settle_private_account = () => {
  if (process.env.SETTLER_PRIVATE_ACCOUNT) {
    return process.env.SETTLER_PRIVATE_ACCOUNT;
  } else {
    return "2763537251e2f27dc6a30179e7bf1747239180f45b92db059456b7da8194995a";
  }
}

export const txSchema = new mongoose.Schema(
    {
      msg: {
        type: String,
        required: true,
      },
      pkx: {
        type: String,
        required: true,
      },
      sigx: {
        type: String,
        required: true,
      }
    }
);

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
    preMerkleRoot: {
        type: String,
        default: '',
    },
    postMerkleRoot: {
        type: String,
        default: '',
    },
    taskId: {
        type: String,
        default: '',
    },
    withdrawArray: [{
          address: { type: String, default:'' },
          amount: { type: BigInt, default:'' },
    }],
    settleStatus: {
        type: String,
        default: 'waiting',  // wait-for settle, settle failed, settle done
    },
    settleTxHash: {
        type: String,
        default: '',
    },
    bundleIndex: {
      type: Number,
      default: 0,
    }
});

export const randSchema = new mongoose.Schema({
    commitment: {
          type: String,
          required: true,
          unique: true,
    },
    seed: Buffer,
});



export const modelTx = mongoose.model('Tx', txSchema);
export const modelJob = mongoose.model('Job', jobSchema);
export const modelBundle = mongoose.model('Bundle', bundleSchema);
export const modelRand = mongoose.model('Rand', randSchema);

export const ServiceHelper = new ZkWasmServiceHelper(endpoint, "", "");


