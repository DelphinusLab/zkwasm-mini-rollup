//import initHostBind, * as hostbind from "./wasmbind/hostbind.js";
import initBootstrap, * as bootstrap from "./bootstrap/bootstrap.js";
import initApplication, * as application from "./application/application.js";
import { verify_sign, LeHexBN } from "./sign.js";
import { test_merkle_db_service, sending_transaction, test_sending_transaction} from "./rpctest.js";
console.log("abc");

const msgHash = new LeHexBN("0xb8f4201833cfcb9dffdd8cf875d6e1328d99b683e8373617a63f41d436a19f7c");
const pkx = new LeHexBN("0x7137da164bacaa9332b307e25c1abd906c5c240dcb27e520b84522a1674aab01");
const pky = new LeHexBN("0x33b51854d1cde428aa0379606752a341b85cf1d47803e22330a0c9d41ce59c2b");
const sigx = new LeHexBN("0x8a4414099b0a433851f7fb34e43febb1298193da413a35bb6951baac25f6ea24");
const sigy = new LeHexBN("0x7e243e753a4b0a792c02c9d550c5569fe5b46a9f710d9d123cd2865e0184fb12");
const sigr = new LeHexBN("0x1e900bb388808fe40f0a11a149a322f576448d497040d72c7b3ebc832d02e701");

let checksign = verify_sign(msgHash, pkx, pky, sigx, sigy, sigr);
console.log("checking signature ...", checksign);

async function main() {
  console.log("bootstraping ...");
  console.log(initBootstrap);
  await (initBootstrap as any)();
  console.log(bootstrap);
  console.log("host binder initialized, initialize application ...");
  await (initApplication as any)(bootstrap);
  console.log("application initialized, testing merkle db service ...");
  application.test_merkle();
  console.log("testing merkle db service done.\n");
  /*
  application.test_insert();
  test_sending_transaction();
  console.log("testing sending transaction ...");
  */

  //sending_transaction([0n,0n,0n,0n], "1234");
  sending_transaction([1n<<32n,0n,0n,0n], "1234");
  sending_transaction([2n<<32n,2n + (1n<<8n),0n,0n], "1234");

}

main();


