import axios from 'axios';
import { sign, query } from "./sign.js";

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class ZKWasmAppRpc {
  private baseUrl: string;
  private instance;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.instance = axios.create({
      baseURL: this.baseUrl,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  public async sendRawTransaction(cmd: Array<bigint>, prikey: string): Promise<JSON> {
    try {
      const data = sign(cmd, prikey);
      const response = await this.instance.post(
        "/send",
        JSON.stringify(data)
      );
      if (response.status === 201) {
        const jsonResponse = response.data;
        return jsonResponse;
      } else {
        throw "SendTransactionError";
      }
    } catch (error) {
      console.error('Error:', error);
      throw "SendTransactionError " + error;
    }
  }

  public async sendTransaction(cmd: Array<bigint>, prikey: string): Promise<number> {
    try {
      let resp:any = await this.sendRawTransaction(cmd, prikey);
      for (let i=0; i<5; i++) {//detect job status with 1 sec delay
        await delay(1000);
        try {
          let jobStatus = await this.queryJobStatus(resp.jobid);
          if (jobStatus.finishedOn != 0) {
            return jobStatus.finishedOn;
          }
        } catch(e) {
          continue
        }
      }
      throw Error("MonitorTransactionFail");
    } catch(e) {
      throw Error("SendTransactionFail");
    }
  }

  async queryState(prikey: string): Promise<JSON> {
    try {
      const data = query(prikey);
      const response = await this.instance.post(
        "/query",
        JSON.stringify(data)
      );
      if (response.status === 201) {
        const jsonResponse = response.data;
        return jsonResponse;
      } else {
        throw "UnexpectedResponseStatus"
      }
    } catch (error: any) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 500) {
          throw "QueryStateError";
        } else {
          throw "UnknownError";
        }
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        throw 'No response was received from the server, please check your network connection.';
      } else {
        throw "UnknownError";
      }
    }
  }

  async query_config(): Promise<JSON> {
    try {
      const response = await this.instance("/config", {
        method: 'POST'
      });

      if (response.status === 201) {
        const jsonResponse = response.data;
        return jsonResponse;
      } else {
        throw "QueryConfigError";
      }
    } catch(error) {
      throw "QueryStateError " + error;
    }
  }

  async queryJobStatus(jobId: number) {
    try {
      const url = `/job/${jobId}`;
      const response = await this.instance(url, {
        method: 'GET',
      });
      if (response.status === 201) {
        const jsonResponse = response.data;
        return jsonResponse;
      } else {
        throw "QueryJobError";
      }
    } catch(error) {
      throw "QueryJobError " + error;
    }
  }
}


