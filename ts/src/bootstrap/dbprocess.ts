import axios from 'axios';
let url = 'http://127.0.0.1:3030';
if (process.env.MERKLE_SERVER) {
  url = process.env.MERKLE_SERVER;
}

export class MerkleServiceRpc {
  private baseUrl: string;
  private instance;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.instance = axios.create({
      baseURL: this.baseUrl,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  public async queryDB(request: any): Promise<void> {
    try {
      const response = await this.instance.post(
        "",
        JSON.stringify(request)
      );
      if (response.status === 200) {
        return response.data
      } else {
        throw Error("SendTransactionError");
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      } else {
        throw Error("UnknownDBError");
      }
    }
  }
}

let serviceRpc = new MerkleServiceRpc(url);
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Listen for the 'line' event to handle user input
rl.on('line', async (input: string) => {
  // console.log(`Received: ${input}`);
  // You can handle different inputs here
  if (input.startsWith("====")) {
    let param = JSON.parse(input.slice(4));
    try {
      let data = await serviceRpc.queryDB(param);
      console.log(JSON.stringify(data));
    } catch (e) {
      let obj = {
        error:(e as Error).message
      };
      console.log(JSON.stringify(obj))
    }
  }
});

// Handle the 'close' event when the interface is closed
rl.on('close', () => {
  console.log('>> Interface closed.');
  process.exit(0);
});
