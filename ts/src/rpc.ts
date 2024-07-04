import fetch from 'sync-fetch';
import { sign, query } from "./sign.js";

export class ZKWasmAppRpc {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public send_transaction(cmd: Array<bigint>, prikey: string) {
    const url = `${this.baseUrl}/send`;
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
      return jsonResponse;
    } else {
      console.log(response);
      console.error('Failed to fetch:', response.statusText);
    }
  }

  public query_state(cmd: Array<bigint>, prikey: string) {
    const url = `${this.baseUrl}/query`;
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
      return jsonResponse;
    } else {
      console.log(response);
      console.error('Failed to fetch:', response.statusText);
    }
  }

  public query_config() {
    const url = `${this.baseUrl}/config`;
    let data: Array<number> = [];
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
      return jsonResponse;
    } else {
      console.log(response);
      console.error('Failed to fetch:', response.statusText);
    }
  }

  public query_jobstatus(jobId: number) {
    const url = `${this.baseUrl}/job/${jobId}`;
    const response = fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
    });

    if (response.ok) {
      const jsonResponse = response.json();
      console.log(jsonResponse);
      return jsonResponse;
    } else {
      console.log(response);
      console.error('Failed to fetch:', response.statusText);
    }
  }
}


