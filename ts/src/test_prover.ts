import { has_uncomplete_task, TxWitness, get_latest_proof, has_task } from "./prover.js";
import { getMerkleArray } from "./contract.js";
import { get_contract_addr } from "./config.js";
let hasTask = await has_task();
let contractAddr = get_contract_addr();

let migrate = false;
let remote = false;

if (hasTask) {
    console.log('has task');
    remote = true;
}

if (!hasTask && contractAddr != "unspecified") {
    try {
      let merkleRoot = await getMerkleArray();
      console.log('migrate merkle root:', merkleRoot);
      migrate = true;
    } catch (e) {
      console.log(e);
    }
  }

console.log('migrate:', migrate);
console.log('remote:', remote);