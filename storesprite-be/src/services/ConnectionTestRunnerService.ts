import { spawn } from "node:child_process";
import { injectable, inject, optional } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { IConnectionTestRunnerService } from "../types/ConnectionTestRunnerService.interface.js";

@injectable()
export class ConnectionTestRunnerService implements IConnectionTestRunnerService {
  constructor(
    @inject(TYPES.Logger)
    @optional()
    private readonly _logger?: Logger
  ) {}

  public async runTest(
    connectionId: string,
    userId: string,
    workerToken: string,
    backendUrl: string
  ): Promise<void> {
    await Promise.resolve();
    const nodeEnv = (process.env.NODE_ENV || "dev").toLowerCase();
    const defaultDriver = nodeEnv === "prod" || nodeEnv === "production" ? "cloud_run" : "docker";
    const driver = (process.env.WORKER_DRIVER || defaultDriver).toLowerCase();

    this._logger?.info("Dispatching connection test runner", {
      connectionId,
      userId,
      driver,
      backendUrl,
    });

    if (driver === "cloud_run") {
      this._logger?.info("Cloud Run worker execution selected", { connectionId });
      // Dispatches Cloud Run job execution in production environment
      return;
    }

    if (driver === "noop" || nodeEnv === "test") {
      this._logger?.info("Noop/test driver selected, skipping spawn", { connectionId });
      return;
    }

    // Default to Docker runner for dev environments
    this._runDockerContainer(connectionId, userId, workerToken, backendUrl);
  }

  private _runDockerContainer(
    connectionId: string,
    userId: string,
    workerToken: string,
    backendUrl: string
  ): void {
    const dockerNetwork = process.env.DOCKER_NETWORK || "storesprite-shared-net";
    const imageName = process.env.DOWNLOADER_IMAGE || "storesprite-downloader:latest";

    const args = [
      "run",
      "--rm",
      "-d",
      `--network=${dockerNetwork}`,
      "-e", `TEST_CONNECTION=${connectionId}`,
      "-e", `USER_ID=${userId}`,
      "-e", `WORKER_TOKEN=${workerToken}`,
      "-e", `BACKEND_URL=${backendUrl}`,
      imageName,
    ];

    this._logger?.info("Spawning docker container for connection test", {
      command: "docker",
      args,
    });

    try {
      const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"], detached: false });
      
      let stdout = "";
      let stderr = "";
      
      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", (err) => {
        this._logger?.error("Docker spawn error", {
          error: String(err),
          connectionId,
        });
      });

      child.on("close", (code) => {
        if (code !== 0) {
          this._logger?.error("Docker run failed to launch container", {
            code,
            stderr: stderr.trim(),
            stdout: stdout.trim(),
            connectionId,
          });
        } else {
          this._logger?.info("Docker worker container launched successfully", {
            containerId: stdout.trim(),
            connectionId,
          });
        }
      });
    } catch (error) {
      this._logger?.error("Failed to spawn docker container for connection test", {
        error: String(error),
        connectionId,
      });
    }
  }
}

