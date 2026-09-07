import { spawn } from "node:child_process";
import path from "node:path";
import { injectable, inject, optional } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../../di/types.js";
import { IConnectionTestRunnerService } from "../../types/stocksprite/ConnectionTestRunnerService.interface.js";

/**
 * Dispatches the combined `storesprite-worker` container. The image always runs the
 * downloader first; `TEST_CONNECTION` short-circuits after it (connection test), and
 * otherwise the processor continues with MAPPING_ID/RUN_ID (mapping run).
 */
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
    token: string,
    backendUrl: string
  ): Promise<void> {
    await Promise.resolve();
    const driver = this._resolveDriver();
    this._logger?.info("Dispatching connection test runner", {
      connectionId,
      userId,
      driver,
      backendUrl,
    });

    if (driver === "cloud_run") {
      this._logger?.info("Cloud Run worker execution selected", { connectionId });
      return;
    }

    if (driver === "noop" || process.env.NODE_ENV?.toLowerCase() === "test") {
      this._logger?.info("Noop/test driver selected, skipping spawn", { connectionId });
      return;
    }

    // Awaiting the container launch lets a build/pull/daemon failure reject runTest so
    // the caller can report it. `docker run -d` returns as soon as the container starts;
    // the worker then reports progress back over the internal API, so this is not a wait.
    await this._runContainer(this._imageName(), {
      CONNECTION_ID: connectionId,
      TEST_CONNECTION: connectionId,
      USER_ID: userId,
      INTERNAL_TOKEN: token,
      BACKEND_URL: backendUrl,
    });
  }

  public async runMapping(
    connectionId: string,
    mappingId: string,
    runId: string,
    userId: string,
    token: string,
    backendUrl: string
  ): Promise<void> {
    await Promise.resolve();
    const driver = this._resolveDriver();
    this._logger?.info("Dispatching mapping runner", {
      connectionId,
      mappingId,
      runId,
      userId,
      driver,
      backendUrl,
    });

    if (driver === "cloud_run") {
      this._logger?.info("Cloud Run worker execution selected", { mappingId });
      return;
    }

    if (driver === "noop" || process.env.NODE_ENV?.toLowerCase() === "test") {
      this._logger?.info("Noop/test driver selected, skipping spawn", { mappingId });
      return;
    }

    // See runTest: launching is awaited so a failure rejects instead of leaving the run
    // history row dangling in "running" with no worker ever reporting back.
    await this._runContainer(this._imageName(), {
      CONNECTION_ID: connectionId,
      MAPPING_ID: mappingId,
      RUN_ID: runId,
      USER_ID: userId,
      INTERNAL_TOKEN: token,
      BACKEND_URL: backendUrl,
      OUTPUT_DIR: "/app/temp",
    });
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

  private _resolveDriver(): string {
    const nodeEnv = (process.env.NODE_ENV || "dev").toLowerCase();
    const defaultDriver = nodeEnv === "prod" || nodeEnv === "production" ? "cloud_run" : "docker";
    return (process.env.INTERNAL_DRIVER || defaultDriver).toLowerCase();
  }

  private _imageName(): string {
    return process.env.STOCKSPRITE_IMAGE || "storesprite-worker:latest";
  }

  private async _ensureImageExists(imageName: string): Promise<void> {
    const inspect = await this._spawnDocker(["image", "inspect", imageName]);
    if (inspect.code === 0) {
      return;
    }

    this._logger?.info(`Docker image '${imageName}' not found locally. Building on-demand...`);

    const buildContext = process.env.STOCKSPRITE_BUILD_CONTEXT || "/workspace";
    const configuredDockerfile = process.env.STOCKSPRITE_DOCKERFILE || "stocksprite/Dockerfile";
    // `-f` is resolved relative to the spawned CLI's working directory (the backend's
    // own cwd), NOT the build context. Resolve relative paths against the context so the
    // on-demand build works regardless of which directory the backend runs from.
    const dockerfile = path.isAbsolute(configuredDockerfile)
      ? configuredDockerfile
      : path.resolve(buildContext, configuredDockerfile);
    const build = await this._spawnDocker(["build", "-f", dockerfile, "-t", imageName, buildContext]);

    if (build.code === 0) {
      this._logger?.info(`Successfully built '${imageName}' on-demand.`);
      return;
    }

    const err = new Error(`Failed to build '${imageName}': ${build.stderr.trim()}`);
    this._logger?.error("Docker build error", { error: err.message });
    throw err;
  }

  private async _runContainer(imageName: string, env: Record<string, string>): Promise<void> {
    const dockerNetwork = process.env.DOCKER_NETWORK || "storesprite-shared-net";

    // Any failure here is thrown (not swallowed): the image build/pull or the container
    // launch never produced a worker, so nothing will report back over the internal API.
    // Rejecting lets the caller surface the error to the UI instead of leaving a
    // connection test or mapping run hanging forever.
    await this._ensureImageExists(imageName);

    const args = ["run", "--rm", "-d", `--network=${dockerNetwork}`];
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }
    args.push(imageName);

    this._logger?.info("Spawning docker container", { command: "docker", args });

    let result: { code: number | null; stdout: string; stderr: string };
    try {
      result = await this._spawnDocker(args);
    } catch (error) {
      // e.g. docker CLI missing (spawn "error" event)
      const err = new Error(
        `Failed to launch docker container for '${imageName}': ${error instanceof Error ? error.message : String(error)}`
      );
      this._logger?.error("Failed to spawn docker container", { error: err.message });
      throw err;
    }

    if (result.code !== 0) {
      const err = new Error(
        `Failed to launch docker container for '${imageName}' (exit ${result.code}): ${result.stderr.trim()}`
      );
      this._logger?.error("Docker run failed to launch container", {
        code: result.code,
        stderr: result.stderr.trim(),
        stdout: result.stdout.trim(),
      });
      throw err;
    }

    this._logger?.info("Docker worker container launched successfully", {
      containerId: result.stdout.trim(),
    });
  }
}
