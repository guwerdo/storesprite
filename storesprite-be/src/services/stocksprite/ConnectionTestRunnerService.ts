import { spawn } from "node:child_process";
import path from "node:path";
import { injectable, inject, optional } from "inversify";
import type { Logger } from "log4js";
import { TYPES } from "../../di/types.js";
import { Util } from "../../utils/index.js";
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

    if (driver === "cloud-run") {
      // Prod defaults to cloud-run, but the launcher is not implemented yet: fail closed so
      // a connection test can never report success without a worker actually having run.
      throw new Error("Cloud Run worker execution is not implemented");
    }

    if (driver === "noop") {
      this._logger?.info("Noop driver selected, skipping spawn", { connectionId });
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

    if (driver === "cloud-run") {
      // See runTest: fail closed until the Cloud Run launcher is implemented.
      throw new Error("Cloud Run worker execution is not implemented");
    }

    if (driver === "noop") {
      this._logger?.info("Noop driver selected, skipping spawn", { mappingId });
      return;
    }

    // See runTest: awaited so a dispatch failure rejects and the caller can fail the run row.
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
    // Only "prod" selects cloud-run; dev/test/unset default to docker.
    const defaultDriver = nodeEnv === "prod" ? "cloud-run" : "docker";
    // WORKER_DRIVER overrides the NODE_ENV default (noop in tests, cloud-run when trialling it).
    return (process.env.WORKER_DRIVER || defaultDriver).toLowerCase();
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

  private _launchError(imageName: string, reason: string): Error {
    return new Error(`Failed to launch docker container for '${imageName}': ${reason}`);
  }

  private async _runContainer(imageName: string, env: Record<string, string>): Promise<void> {
    const dockerNetwork = process.env.DOCKER_NETWORK || "storesprite-shared-net";

    // Throwing (not swallowing) is deliberate: a build/pull/daemon failure means no
    // container exists to report back over the internal API, so the caller must surface
    // the rejection or the connection test / mapping run hangs forever.
    await this._ensureImageExists(imageName);

    const args = ["run", "--rm", "-d", `--network=${dockerNetwork}`];
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }
    args.push(imageName);

    this._logger?.info("Spawning docker container", { command: "docker", args });

    // e.g. the docker CLI is missing (spawn "error" event). Callers log the rejection,
    // so there is no throw-site log for this branch.
    const { code, stdout, stderr } = await this._spawnDocker(args).catch((error: unknown) => {
      throw this._launchError(imageName, Util.describeError(error));
    });

    if (code !== 0) {
      const stderrText = stderr.trim();
      const launchErr = this._launchError(imageName, `exit ${code}: ${stderrText}`);
      this._logger?.error("Docker run failed to launch container", {
        code,
        stderr: stderrText,
        stdout: stdout.trim(),
      });
      throw launchErr;
    }

    this._logger?.info("Docker worker container launched successfully", {
      containerId: stdout.trim(),
    });
  }
}
