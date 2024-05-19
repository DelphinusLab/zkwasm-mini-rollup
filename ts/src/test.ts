//import initHostBind, * as hostbind from "./wasmbind/hostbind.js";
import initBootstrap, * as bootstrap from "./bootstrap/bootstrap.js";
import initApplication, * as application from "./application/application.js";
console.log("abc");

async function main() {
   console.log("bootstraping ...");
   console.log(initBootstrap);
   await (initBootstrap as any)();
   console.log(bootstrap);
   console.log("host binder initialized ...");
   await (initApplication as any)(bootstrap);
   bootstrap.poseidon_new(1n);
   bootstrap.cache_set_mode(1n);
}

main();
