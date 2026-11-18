import type { Express } from "express";
import { EventEmitter } from "node:events";
import { Readable, Duplex } from "node:stream";

export interface TestResponse {
  status: number;
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  text: string;
}

export class TestRequest {
  private app: Express;
  private method: string;
  private url: string;
  private headers: Record<string, string> = {};
  private data?: any;

  constructor(app: Express, method: string, url: string) {
    this.app = app;
    this.method = method;
    this.url = url;
  }

  set(header: string, value: string): this {
    this.headers[header.toLowerCase()] = value;
    return this;
  }

  send(data: any): this {
    this.data = data;
    return this;
  }

  then<TResult1 = TestResponse, TResult2 = never>(
    onfulfilled?: ((value: TestResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  async execute(): Promise<TestResponse> {
    return new Promise((resolve, reject) => {
      let bodyPayload = "";
      if (this.data !== undefined) {
        bodyPayload = typeof this.data === "string" ? this.data : JSON.stringify(this.data);
        if (!this.headers["content-type"]) {
          this.headers["content-type"] = "application/json";
        }
        this.headers["content-length"] = Buffer.byteLength(bodyPayload).toString();
      }

      const req = new Readable({
        read() {
          if (bodyPayload) {
            this.push(bodyPayload);
          }
          this.push(null);
        },
      }) as any;

      req.method = this.method;
      req.url = this.url;
      req.headers = this.headers;
      req.rawHeaders = Object.entries(this.headers).flat();

      const socket = new Duplex({
        read() {},
        write(_chunk, _encoding, callback) {
          callback();
        },
      });
      (socket as any).remoteAddress = "127.0.0.1";
      req.socket = socket;
      req.connection = socket;

      const res = new EventEmitter() as any;
      const responseHeaders: Record<string, string> = {};
      let responseBody = "";

      res.statusCode = 200;
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };

      res.setHeader = (key: string, value: any) => {
        responseHeaders[key.toLowerCase()] = String(value);
      };

      res.getHeader = (key: string) => {
        return responseHeaders[key.toLowerCase()];
      };

      res.writeHead = (status: number, headers?: Record<string, any>) => {
        res.statusCode = status;
        if (headers) {
          for (const [k, v] of Object.entries(headers)) {
            responseHeaders[k.toLowerCase()] = String(v);
          }
        }
        return res;
      };

      res.write = (chunk: any) => {
        if (chunk) {
          responseBody += chunk.toString();
        }
        return true;
      };

      res.end = (chunk?: any) => {
        if (chunk) {
          responseBody += chunk.toString();
        }
        res.emit("finish");

        let parsedBody = responseBody;
        try {
          parsedBody = JSON.parse(responseBody);
        } catch {
          // keep as string
        }

        resolve({
          status: res.statusCode,
          statusCode: res.statusCode,
          headers: responseHeaders,
          body: parsedBody,
          text: responseBody,
        });
      };

      try {
        this.app(req, res);
      } catch (err) {
        reject(err);
      }
    });
  }
}

export function request(app: Express) {
  return {
    get: (url: string) => new TestRequest(app, "GET", url),
    post: (url: string) => new TestRequest(app, "POST", url),
    put: (url: string) => new TestRequest(app, "PUT", url),
    delete: (url: string) => new TestRequest(app, "DELETE", url),
  };
}
