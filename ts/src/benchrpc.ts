import { exec } from 'child_process';
import * as fs from 'fs';

let correctRoot = [209, 25, 6, 57, 202, 38, 63, 205, 230, 191, 218, 42, 142, 209, 137, 151, 3, 59, 129, 218, 89, 249, 19, 143, 222, 94, 61, 88, 8, 55, 104, 39];

let wrongRoot = [208, 107, 182, 47, 101, 239, 49, 228, 249, 118, 179, 167, 239, 211, 131, 101, 81, 103, 108, 174, 203, 236, 108, 251, 125, 22, 81, 58, 216, 86, 46, 1];

var requestData = {
  jsonrpc: '2.0',
  method: 'get_leaf',
  params: {
    root: wrongRoot,
    index: (4294967296n).toString()
  },
  id: 123
};

let ps = exec('node dbprocess.js');
//let ps = exec('node ccat.js');
const buffer = Buffer.alloc(4096);

function test(root: Array<number>) {
  requestData.params.root = root;
  let jsonStr = JSON.stringify(requestData);
  fs.writeSync((ps.stdin as any)._handle.fd, "====" + jsonStr + "\n");
  //fs.writeSync((ps.stdin as any)._handle.fd, "Foo\n");
  //console.log(jsonStr);
  let result = "";
  let input = "";
  while (true) {
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync((ps.stdout as any)._handle.fd, buffer);
      //console.log("bytesRead", bytesRead);
    } catch (error) {
      if (error && (error as any).code === "EAGAIN") {
        //console.log("reading ....");
        continue;
      } else {
        throw error; // Re-throw other errors
      }
    }
    if (bytesRead > 0) {
      input += buffer.toString("utf8", 0, bytesRead);
    }
    console.log("input:", input.indexOf("\n"), input.split('\n').length);
    if (input.indexOf("\n") != -1) {
      input = input.split('\n')[0]
      console.log("input split:", input);
      result = input;
      break;
    } else {
      continue
    }
  }
  return result;
}
let start = performance.now();
let result = test(wrongRoot)
console.log("result is:", result);
let end = performance.now();
console.log("bench for empty fetch is:", end-start);
start = performance.now();
result = test(correctRoot);
console.log("result is:", result);
end = performance.now();
console.log("bench for empty fetch is:", end-start);
console.log("end");
ps.kill();
