import fetch from 'sync-fetch';
import { verify_sign, LeHexBN, sign, query } from "./sign.js";

export function send_transaction(cmd: Array<bigint>, prikey: string) {
  const url = 'http://localhost:3000/send';
  let data = sign(cmd, prikey);
  const response = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (response.ok) {
    const jsonResponse = response.json();
    console.log(jsonResponse);
  } else {
    console.log(response);
    console.error('Failed to fetch:', response.statusText);
  }
}

export function query_state(cmd: Array<bigint>, prikey: string) {
  const url = 'http://localhost:3000/query';
  let data = query(prikey);
  console.log("query data", data);
  const response = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (response.ok) {
    const jsonResponse = response.json();
    console.log(jsonResponse);
  } else {
    console.log(response);
    console.error('Failed to fetch:', response.statusText);
  }
}
