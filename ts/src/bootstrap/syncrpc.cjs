const exec = require('child_process');
const path = require('path');
const fs = require('fs');

console.log("process path", path.join(__dirname, 'dbprocess.js'));
console.log("exec path", process.execPath);

let ps = exec.exec(`${process.execPath} ${path.join(__dirname, 'dbprocess.js')}`);
//let ps = exec.exec('node /home/xgao/zkWasm-server/zkwasm-typescript-mini-server/ts/src/bootstrap/dbprocess.js');
const buffer = Buffer.alloc(4096);
//console.log(ps);

function requestMerkleData(requestData) {
  let jsonStr = JSON.stringify(requestData);
  fs.writeSync((ps.stdin)._handle.fd, "====" + jsonStr + "\n");
  let result = "";
  let input = "";
  while (true) {
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync((ps.stdout)._handle.fd, buffer);
      //console.log("bytesRead", bytesRead);
    } catch (error) {
      if (error && (error).code === "EAGAIN") {
        //console.log("read bytes!", bytesRead);
        continue;
      } else {
        throw error; // Re-throw other errors
      }
    }
    if (bytesRead > 0) {
      input += buffer.toString("utf8", 0, bytesRead);
    }
    //console.log("input:", input.indexOf("\n"), input.split('\n').length);
    if (input.indexOf("\n") != -1) {
      input = input.split('\n')[0]
      //console.log("input split:", input);
      result = input;
      break;
    } else {
      continue
    }
  }
  return result;
}

module.exports = requestMerkleData
