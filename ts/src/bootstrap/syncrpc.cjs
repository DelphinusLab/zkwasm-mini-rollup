const ps = {
  process: null,
  fs: null,
}
const buffer = Buffer.alloc(4096);

function requestMerkleData(requestData) {
  if (typeof window === "undefined") {
    if (ps.process == null) {
      console.log("detect in node js env. create sync process");
      const exec = require('child_process');
      const path = require('path');
      const fs = require('fs');

      console.log("process path", path.join(__dirname, 'dbprocess.js'));
      console.log("exec path", process.execPath);

      ps.fs = fs;
      ps.process = exec.exec(`${process.execPath} ${path.join(__dirname, 'dbprocess.js')}`);
      //let ps = exec.exec('node /home/xgao/zkWasm-server/zkwasm-typescript-mini-server/ts/src/bootstrap/dbprocess.js');
      }
  }

  if (ps.process == null) {
     throw Error("Process not supported");
  } else {
     let jsonStr = JSON.stringify(requestData);
     ps.fs.writeSync((ps.process.stdin)._handle.fd, "====" + jsonStr + "\n");
     let result = "";
     let input = "";
     while (true) {
         let bytesRead = 0;
         try {
           bytesRead = ps.fs.readSync((ps.process.stdout)._handle.fd, buffer);
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
}
module.exports = requestMerkleData
