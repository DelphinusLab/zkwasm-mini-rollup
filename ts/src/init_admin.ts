import * as fs from "fs";
import { get_server_admin_pubkey } from "./config.js";
const ofile = process.argv[2];

const writeBytesToFile = (filePath: string, byteArray: Uint8Array): void => {
      fs.writeFileSync(filePath, Buffer.from(byteArray));
          console.log(`admin pubkey bytes written to ${filePath}`);
};


const readBytesFromFile = (filePath: string): Uint8Array => {
  // Read the file contents into a Buffer
  const fileBuffer = fs.readFileSync(filePath);
  // Convert the Buffer to a Uint8Array
  return new Uint8Array(fileBuffer);
};

function generate_admin_pubkey_file() {
  let pubkey = get_server_admin_pubkey();
  writeBytesToFile(ofile, Buffer.from(pubkey.toArray("le", 32)));
  let reads = readBytesFromFile(ofile);
  console.log("write:", pubkey.toArray("le", 32));
  console.log("read:", reads);
}

generate_admin_pubkey_file();
