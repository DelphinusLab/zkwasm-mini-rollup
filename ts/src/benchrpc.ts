import fetch from 'sync-fetch';

import dotenv from 'dotenv';
dotenv.config();

// Load environment variables from .env file
//
let url = 'http://127.0.0.1:3030';
if (process.env.MERKLE_SERVER) {
  url = process.env.MERKLE_SERVER;
}

export function testBench() {
  const requestData = {
    jsonrpc: '2.0',
    method: 'dummy',
    params: {
      root: [208, 107, 182, 47, 101, 239, 49, 228, 249, 118, 179, 167, 239, 211, 131, 101, 81, 103, 108, 174, 203, 236, 108, 251, 125, 22, 81, 58, 216, 86, 46, 1],
      index: (1n).toString()
    },
    id: 123
  };

  const response = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = response.json();
    console.log(jsonResponse);
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw ("Connecting with merkel db service fail!");
  }
}

const start = performance.now();
testBench();
const end = performance.now();
console.log("bench for empty fetch is:", end-start);
