//import initHostBind, * as hostbind from "./wasmbind/hostbind.js";
import initHostBind, * as hostbind from "./js/bootstrap.js";
console.log("abc");

async function main() {
   console.log("start running ...");
   console.log(hostbind);
   console.log(initHostBind);
   await (initHostBind as any)();
   hostbind.poseidon_new(1n);
   hostbind.cache_set_mode(1n);
}

main();
