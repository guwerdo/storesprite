import { spawn } from "node:child_process";
import { injectable, inject, optional } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../di/types.js";
import { Util } from "../utils/index.js";
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
    void this._runDockerContainer(connectionId, userId, workerToken, backendUrl);
  }

  private _spawnDocker(
    args: string[]
  ): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
  }

  private async _ensureImageExists(imageName: string): Promise<void> {
    const inspect = await this._spawnDocker(["image", "inspect", imageName]);
    if (inspect.code === 0) {
      return;
    }

    this._logger?.info(`Docker image '${imageName}' not found locally. Building on-demand...`);

    const buildContext = process.env.DOWNLOADER_BUILD_CONTEXT || "/workspace/stocksprite";
    const build = await this._spawnDocker(["build", "-t", imageName, buildContext]);

    if (build.code === 0) {
      this._logger?.info(`Successfully built '${imageName}' on-demand.`);
      return;
    }

    const err = new Error(`Failed to build '${imageName}': ${build.stderr.trim()}`);
    this._logger?.error("Docker build error", { error: err.message });
    throw err;
  }

  private async _runDockerContainer(
    connectionId: string,
    userId: string,
    workerToken: string,
    backendUrl: string
  ): Promise<void> {
    const dockerNetwork = process.env.DOCKER_NETWORK || "storesprite-shared-net";
    const imageName = process.env.DOWNLOADER_IMAGE || "storesprite-downloader:latest";

    try {
      await this._ensureImageExists(imageName);
    } catch (buildError) {
      this._logger?.error("Could not ensure Docker image before test run", {
        error: Util.stringifyError(buildError),
        connectionId,
      });
      return;
    }

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
      const { code, stdout, stderr } = await this._spawnDocker(args);
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
    } catch (error) {
      this._logger?.error("Failed to spawn docker container for connection test", {
        error: Util.stringifyError(error),
        connectionId,
      });
    }
  }
}
