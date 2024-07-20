import axios from 'axios';
import { sign, query } from "./sign.js";

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

  public async send_transaction(cmd: Array<bigint>, prikey: string): Promise<JSON> {
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

  async query_state(prikey: string): Promise<JSON> {
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

  async query_jobstatus(jobId: number) {
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


