//import initHostBind, * as hostbind from "./wasmbind/hostbind.js";
import { verify_sign, LeHexBN, query } from "./sign.js";
import { ZKWasmAppRpc } from "./rpc.js";
import BN from "bn.js";

const msgHash = new LeHexBN("0xb8f4201833cfcb9dffdd8cf875d6e1328d99b683e8373617a63f41d436a19f7c");
const pkx = new LeHexBN("0x7137da164bacaa9332b307e25c1abd906c5c240dcb27e520b84522a1674aab01");
const pky = new LeHexBN("0x33b51854d1cde428aa0379606752a341b85cf1d47803e22330a0c9d41ce59c2b");
const sigx = new LeHexBN("0x8a4414099b0a433851f7fb34e43febb1298193da413a35bb6951baac25f6ea24");
const sigy = new LeHexBN("0x7e243e753a4b0a792c02c9d550c5569fe5b46a9f710d9d123cd2865e0184fb12");
const sigr = new LeHexBN("0x1e900bb388808fe40f0a11a149a322f576448d497040d72c7b3ebc832d02e701");

let checksign = verify_sign(msgHash, pkx, pky, sigx, sigy, sigr);
console.log("checking signature ...", checksign);

/* The modifier mush less than eight */
function encode_modifier(modifiers: Array<bigint>) {
  let c = 0n;
  for (const m of modifiers) {
    c = (c << 8n) + m;
  }
  return c;
}

const CMD_INSTALL_PLAYER = 1n;
const CMD_INSTALL_OBJECT = 2n;
const CMD_RESTART_OBJECT = 3n;
const CMD_WITHDRAW= 4n;
const CMD_DEPOSIT = 4n;

function addrToParams(bn: BN): Array<bigint> {
  // address is encoded in BigEndian
  const mask = new BN('ffffffffffffffff', 16);
  let a = bn.and(mask).toArray('le', 8);
  let b = bn.shrn(64).and(mask).toArray('le', 8);
  let c = bn.shrn(128).and(mask).toArray('le', 8);
  let aHex = a.map(byte => byte.toString(16).padStart(2, '0')).join('');
  let bHex = b.map(byte => byte.toString(16).padStart(2, '0')).join('');
  let cHex = c.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return [BigInt(`0x${cHex}`), BigInt(`0x${bHex}`), BigInt(`0x${aHex}`)];
}

function createCommand(command: bigint, objindex: bigint) {
  return (command << 32n) + objindex;
}

let account = "1234";

const rpc = new ZKWasmAppRpc("http://localhost:3000");


async function main() {
  //sending_transaction([0n,0n,0n,0n], "1234");
  rpc.query_config();
  let install_command = createCommand(CMD_INSTALL_PLAYER, 0n);
  rpc.send_transaction([install_command,0n,0n,0n], account);
  let modifiers = encode_modifier([0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n]);
  let command = createCommand(CMD_INSTALL_OBJECT, 0n);
  let job = rpc.send_transaction([command, modifiers,0n,0n], account);
  rpc.query_jobstatus(job.jobid);

  command = createCommand(CMD_INSTALL_OBJECT, 0n);
  job = rpc.send_transaction([command, modifiers,0n,0n], account);
  rpc.query_jobstatus(job.jobid);

  rpc.query_state([1n], account);

  let accountInfo = new LeHexBN(query(account).pkx).toU64Array();
  let command_deposit = createCommand(CMD_DEPOSIT, 0n);
  rpc.send_transaction([command_deposit, accountInfo[1], accountInfo[2], 1000n], account);

  let command_withdraw = createCommand(CMD_WITHDRAW, 0n);
  let addParams = addrToParams(new BN('123456789011121314', 16));
  rpc.send_transaction([command_withdraw, addParams[0], addParams[1], addParams[2]], account);
}

main();
// sending_transaction([2n<<32n,2n + (1n<<8n) + (3n<<16n),0n,0n], "1234");


