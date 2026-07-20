import * as express from "express";
import * as cors from "cors";
import * as path from "path";
import * as http from "http";
import { GitweClient } from "../gitwe/client";
import { setupRoutes } from "./routes";

export class WebGuiServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private port: number;

  constructor(
    private client: GitweClient,
    port: number = 5678,
  ) {
    this.port = port;
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, "static")));
    setupRoutes(this.app, this.client);
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`🌐 Gitwe WebGUI running at http://localhost:${this.port}`);
        resolve();
      });
      this.server.on("error", reject);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getPort(): number {
    return this.port;
  }
}
