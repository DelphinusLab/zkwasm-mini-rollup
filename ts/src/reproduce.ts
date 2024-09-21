import BN from "bn.js";
import { ServiceHelper, get_contract_addr, modelBundle, get_user_private_account } from "./config.js";
import abiData from './Proxy.json' assert { type: 'json' };
import {ZkWasmUtil, PaginationResult, QueryParams, Task, VerifyProofParams} from "zkwasm-service-helper";
import { U8ArrayUtil, NumberUtil } from './lib.js';

import * as fs from 'fs';

async function getTask(taskid: string) {
  const queryParams: QueryParams = {
          id: taskid,
          tasktype: "Prove",
          taskstatus: null,
          user_address: null,
          md5: null,
          total: 1,
        };

  const response: PaginationResult<Task[]> = await ServiceHelper.loadTasks(
    queryParams
  );
  return response.data[0];
}

async function trySettle(taskId: string) {
  const data0 = await getTask(taskId);
  const public_inputs = data0.public_inputs;
  const private_inputs = data0.private_inputs;
  fs.writeFileSync('output.txt', `$CLI --params $PARAMS dry-run --wasm $IMAGE \\\n`, 'utf-8');
  for (const p of public_inputs) {
    fs.appendFileSync('output.txt', `--public ${p} \\\n`, 'utf-8');
  }
  for (const p of private_inputs) {
    fs.appendFileSync('output.txt', `--private ${p} \\\n`, 'utf-8');
  }
  fs.appendFileSync('output.txt', `--output $OUTPUT`, 'utf-8');
}

trySettle("66ee9d79d988d3dbdfd2b891");
