import fetch from 'sync-fetch';
import { verify_sign, LeHexBN } from "./sign.js";

export function test_merkle_db_service() {
  const url = 'http://127.0.0.1:3030';

  const requestData = {
    jsonrpc: '2.0',
    method: 'get_leaf',
    params: [{ root: [
      209, 25, 6, 57, 202, 38, 63, 205,
      230, 191, 218, 42, 142, 209, 137, 151,
      3, 59, 129, 218, 89, 249, 19, 143,
      222, 94, 61, 88, 8, 55, 104, 39
    ], index: ((1n<<32n) + 2n).toString()
    }],
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
  }
}

export function test_sending_transaction() {
  const url = 'http://localhost:3000';
  const msgHash = new LeHexBN("0xb8f4201833cfcb9dffdd8cf875d6e1328d99b683e8373617a63f41d436a19f7c");
  const pkx = new LeHexBN("0x7137da164bacaa9332b307e25c1abd906c5c240dcb27e520b84522a1674aab01");
  const pky = new LeHexBN("0x33b51854d1cde428aa0379606752a341b85cf1d47803e22330a0c9d41ce59c2b");
  const sigx = new LeHexBN("0x8a4414099b0a433851f7fb34e43febb1298193da413a35bb6951baac25f6ea24");
  const sigy = new LeHexBN("0x7e243e753a4b0a792c02c9d550c5569fe5b46a9f710d9d123cd2865e0184fb12");
  const sigr = new LeHexBN("0x1e900bb388808fe40f0a11a149a322f576448d497040d72c7b3ebc832d02e701");

  const requestData = {
    msg: msgHash,
    pkx: pkx,
    pky: pky,
    sigx: sigx,
    sigy: sigy,
    sigr: sigr,
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
    console.log(response);
    console.error('Failed to fetch:', response.statusText);
  }
}
