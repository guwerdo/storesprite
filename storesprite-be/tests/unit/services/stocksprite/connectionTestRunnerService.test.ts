import "reflect-metadata";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

import { spawn } from "node:child_process";
import { ConnectionTestRunnerService } from "../../../../src/services/stocksprite/ConnectionTestRunnerService.js";

const spawnMock = vi.mocked(spawn);

type CloseHandler = (code: number | null, signal: NodeJS.Signals | null) => void;

function mockSpawnSuccess(): ReturnType<typeof vi.fn> {
  const impl = vi.fn(() => {
    const handlers: Record<string, CloseHandler> = {};
    const child = {
      stdout: null,
      stderr: null,
      on: vi.fn((event: string, cb: CloseHandler) => {
        handlers[event] = cb;
        return child;
      }),
    };
    setImmediate(() => {
      handlers["close"]?.(0, null);
    });
    return child;
  });
  spawnMock.mockImplementation(impl as unknown as typeof spawn);
  return impl;
}

const settle = async (times = 8): Promise<void> => {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

function envEntries(args: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "-e" && args[i + 1] !== undefined) {
      out.push("-e", args[i + 1]);
    }
  }
  return out;
}

describe("ConnectionTestRunnerService", () => {
  let service: ConnectionTestRunnerService;

  const saveEnv = (): Record<string, string | undefined> => {
    const keys = [
      "INTERNAL_DRIVER",
      "NODE_ENV",
      "STOCKSPRITE_IMAGE",
      "STOCKSPRITE_BUILD_CONTEXT",
      "STOCKSPRITE_DOCKERFILE",
      "DOCKER_NETWORK",
    ];
    const snap: Record<string, string | undefined> = {};
    for (const k of keys) snap[k] = process.env[k];
    return snap;
  };

  const restoreEnv = (snap: Record<string, string | undefined>): void => {
    for (const [k, v] of Object.entries(snap)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };

  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    // Vitest 4 no longer resets a module mock's call history via vi.restoreAllMocks()
    // in afterEach, so clear here — the last tests assert spawn was never called.
    vi.clearAllMocks();
    envSnapshot = saveEnv();
    service = new ConnectionTestRunnerService();
    // Ensure a docker driver by default; NODE_ENV must not short-circuit to noop.
    delete process.env.NODE_ENV;
    process.env.INTERNAL_DRIVER = "docker";
    process.env.STOCKSPRITE_IMAGE = "storesprite-worker:latest";
    process.env.STOCKSPRITE_DOCKERFILE = "stocksprite/Dockerfile";
    process.env.STOCKSPRITE_BUILD_CONTEXT = "/workspace";
    process.env.DOCKER_NETWORK = "test-net";
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    vi.restoreAllMocks();
  });

  it("runMapping: spawns docker run with the mapping environment once the image exists", async () => {
    const impl = mockSpawnSuccess();

    await service.runMapping("conn1", "map1", "run1", "u1", "tok", "http://be:3000");
    await settle();

    expect(impl).toHaveBeenCalledTimes(2);
    // Image inspection short-circuits the build because it succeeds.
    expect(impl.mock.calls[0][1]).toEqual(["image", "inspect", "storesprite-worker:latest"]);

    const runArgs = impl.mock.calls[1][1] as string[];
    expect(runArgs.slice(0, 4)).toEqual(["run", "--rm", "-d", "--network=test-net"]);
    const env = envEntries(runArgs);
    expect(env).toEqual([
      "-e",
      "CONNECTION_ID=conn1",
      "-e",
      "MAPPING_ID=map1",
      "-e",
      "RUN_ID=run1",
      "-e",
      "USER_ID=u1",
      "-e",
      "INTERNAL_TOKEN=tok",
      "-e",
      "BACKEND_URL=http://be:3000",
      "-e",
      "OUTPUT_DIR=/app/temp",
    ]);
    expect(runArgs[runArgs.length - 1]).toBe("storesprite-worker:latest");
  });

  it("runTest: spawns docker run with the connection-test environment", async () => {
    const impl = mockSpawnSuccess();

    await service.runTest("conn9", "u1", "tok", "http://be:3000");
    await settle();

    const runArgs = impl.mock.calls[1][1] as string[];
    const env = envEntries(runArgs);
    expect(env).toEqual([
      "-e",
      "TEST_CONNECTION=conn9",
      "-e",
      "USER_ID=u1",
      "-e",
      "INTERNAL_TOKEN=tok",
      "-e",
      "BACKEND_URL=http://be:3000",
    ]);
  });

  it("builds the image on-demand when it is not present locally", async () => {
    const impl = vi.fn(() => {
      const handlers: Record<string, CloseHandler> = {};
      const child = {
        stdout: null,
        stderr: null,
        on: vi.fn((event: string, cb: CloseHandler) => {
          handlers[event] = cb;
          return child;
        }),
      };
      setImmediate(() => {
        // first call (inspect) fails, build succeeds, then run succeeds
        const isInspect = impl.mock.calls[0] === undefined || impl.mock.calls.length === 1;
        handlers["close"]?.(isInspect ? 1 : 0, null);
      });
      return child;
    });
    spawnMock.mockImplementation(impl as unknown as typeof spawn);

    await service.runMapping("conn1", "map1", "run1", "u1", "tok", "http://be:3000");
    await settle();

    expect(impl).toHaveBeenCalledTimes(3);
    // The dockerfile is resolved to an absolute path against the build context, because
    // `-f` is interpreted relative to the spawned CLI's cwd (the backend's own working
    // directory), not the context — the backend's cwd is /workspace/storesprite-be, where
    // `stocksprite/Dockerfile` does not exist.
    expect(impl.mock.calls[1][1]).toEqual([
      "build",
      "-f",
      "/workspace/stocksprite/Dockerfile",
      "-t",
      "storesprite-worker:latest",
      "/workspace",
    ]);
  });

  it("builds with the default absolute dockerfile when no overrides are set", async () => {
    delete process.env.STOCKSPRITE_DOCKERFILE;
    delete process.env.STOCKSPRITE_BUILD_CONTEXT;

    const impl = vi.fn(() => {
      const handlers: Record<string, CloseHandler> = {};
      const child = {
        stdout: null,
        stderr: null,
        on: vi.fn((event: string, cb: CloseHandler) => {
          handlers[event] = cb;
          return child;
        }),
      };
      setImmediate(() => {
        const isInspect = impl.mock.calls.length === 1;
        handlers["close"]?.(isInspect ? 1 : 0, null);
      });
      return child;
    });
    spawnMock.mockImplementation(impl as unknown as typeof spawn);

    await service.runMapping("conn1", "map1", "run1", "u1", "tok", "http://be:3000");
    await settle();

    expect(impl.mock.calls[1][1]).toEqual([
      "build",
      "-f",
      "/workspace/stocksprite/Dockerfile",
      "-t",
      "storesprite-worker:latest",
      "/workspace",
    ]);
  });

  it("passes an absolute STOCKSPRITE_DOCKERFILE override through verbatim", async () => {
    process.env.STOCKSPRITE_DOCKERFILE = "/custom/worker/Dockerfile";

    const impl = vi.fn(() => {
      const handlers: Record<string, CloseHandler> = {};
      const child = {
        stdout: null,
        stderr: null,
        on: vi.fn((event: string, cb: CloseHandler) => {
          handlers[event] = cb;
          return child;
        }),
      };
      setImmediate(() => {
        const isInspect = impl.mock.calls.length === 1;
        handlers["close"]?.(isInspect ? 1 : 0, null);
      });
      return child;
    });
    spawnMock.mockImplementation(impl as unknown as typeof spawn);

    await service.runMapping("conn1", "map1", "run1", "u1", "tok", "http://be:3000");
    await settle();

    expect(impl.mock.calls[1][1]).toEqual([
      "build",
      "-f",
      "/custom/worker/Dockerfile",
      "-t",
      "storesprite-worker:latest",
      "/workspace",
    ]);
  });

  it("skips the spawn entirely under the test driver", async () => {
    process.env.INTERNAL_DRIVER = "noop";

    await service.runMapping("conn1", "map1", "run1", "u1", "tok", "http://be:3000");

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("skips the spawn entirely under the cloud_run driver", async () => {
    process.env.INTERNAL_DRIVER = "cloud_run";

    await service.runMapping("conn1", "map1", "run1", "u1", "tok", "http://be:3000");

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("defaults to cloud_run in production when no driver override is set", async () => {
    delete process.env.INTERNAL_DRIVER;
    process.env.NODE_ENV = "production";

    await service.runMapping("conn1", "map1", "run1", "u1", "tok", "http://be:3000");

    expect(spawnMock).not.toHaveBeenCalled();
  });
});
