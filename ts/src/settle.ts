import { ZKWasmAppRpc } from "./rpc.js";

const CMD_WITHDRAW= 4n;

function createCommand(command: bigint, objindex: bigint) {
  return (command << 32n) + objindex;
}

const rpc = new ZKWasmAppRpc("http://localhost:3000");

let account = "1234";
async function main() {
  let command_withdraw = createCommand(CMD_WITHDRAW, 0n);
    rpc.send_transaction([command_withdraw, 0n,0n,0n], account);
}

main();
