import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const COMPOSE_FILE = path.resolve(__dirname, "docker-compose-test-integration.yaml");
// /workspace inside the dev container; repo root when run from the host.
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const TEST_INTEGRATION_DIR = __dirname;
const TEMP_DIR = path.resolve(__dirname, "temp");
// The mock services publish their HTTP ports on the Docker host. When this suite
// runs from the host, that host is reached via 127.0.0.1. When it runs inside the
// stocksprite-dev container, the host is reached via host.docker.internal
// (baked into the image as MOCK_HOST).
const MOCK_HOST = process.env.MOCK_HOST || "127.0.0.1";

function cleanTempDir(): void {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Probe the datasource mock's sshd by reading its SSH banner from the host-published
// port 2224. A bare TCP connect can succeed via docker-proxy before sshd inside the
// container is actually accepting, so wait for the "SSH-2.0-..." identification
// string instead. Mirrors the HTTP readiness probes on 8088/8089.
function sshdIsReady(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(2224, host);
    let settled = false;
    const done = (ready: boolean): void => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(ready);
      }
    };
    socket.setTimeout(2000);
    socket.once("data", (chunk: Buffer) => done(chunk.toString().startsWith("SSH-2.0-")));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

// A mapping run: the container is booted with CONNECTION_ID (plus USER_ID etc.) and
// downloads/converts exactly that one connection to <OUTPUT_DIR>/<CONNECTION_ID>.csv.
function baseEnv(connectionId: string): Record<string, string> {
  return {
    USER_ID: "integration_runner",
    INTERNAL_TOKEN: "mock_internal_token",
    BACKEND_URL: "http://mock-backend:8080",
    OUTPUT_DIR: "/app/temp",
    CONNECTION_ID: connectionId,
  };
}

function runDownloaderContainer(
  env: Record<string, string>
): { exitCode: number; stdout: string; stderr: string } {
  const containerName = `storesprite-dl-int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Do NOT bind-mount the temp dir into the container: this harness runs from
  // inside the stocksprite-dev container against the HOST Docker engine, which
  // resolves bind sources in its own namespace. A /workspace/... source would
  // mount an empty directory there, so the downloader's output would never reach
  // the host temp dir the assertions read. Instead run a named container, read
  // its exit code, `docker cp` the produced files back out, then remove it.
  const dockerArgs: string[] = [
    "run",
    "--name",
    containerName,
    "--network",
    "storesprite-integration-net",
  ];
  for (const [key, value] of Object.entries(env)) {
    dockerArgs.push("-e", `${key}=${value}`);
  }
  dockerArgs.push("storesprite-downloader:test-integration");

  const run = spawnSync("docker", dockerArgs, {
    encoding: "utf-8",
    cwd: REPO_ROOT,
  });

  try {
    // Pull the downloader's output (converted CSVs + downloader.log) out of the
    // container's filesystem into the temp dir the assertions read below.
    spawnSync("docker", ["cp", `${containerName}:/app/temp/.`, TEMP_DIR], {
      encoding: "utf-8",
      cwd: REPO_ROOT,
    });
  } finally {
    spawnSync("docker", ["rm", "-f", containerName], {
      encoding: "utf-8",
      cwd: REPO_ROOT,
    });
  }

  return {
    exitCode: run.status ?? 1,
    stdout: run.stdout || "",
    stderr: run.stderr || "",
  };
}

describe("StoreSprite Downloader Container Integration Test Suite", () => {
  beforeAll(async () => {
    cleanTempDir();

    // 1. Build the downloader-only runtime image (production Dockerfile, `--target downloader-runtime`).
    //    DOCKER_BUILDKIT=1 ensures the target's ancestor stages are pruned (the legacy builder
    //    would otherwise also run the unrelated `packages` stage and fail).
    console.log("[Integration Test] Building storesprite-downloader:test-integration image...");
    execSync(
      "docker build --target downloader-runtime -t storesprite-downloader:test-integration -f stocksprite/Dockerfile .",
      {
        cwd: REPO_ROOT,
        env: { ...process.env, DOCKER_BUILDKIT: "1", BUILDKIT_PROGRESS: "plain" },
        stdio: "inherit",
      }
    );

    // 2. Start mock-backend and mock-datasource-server services (rebuilding mock-backend
    //    so the new single-connection WireMock mappings in wiremock/mappings are baked in).
    console.log("[Integration Test] Starting mock-backend and mock-datasource-server services via docker-compose...");
    execSync(`docker compose -f "${COMPOSE_FILE}" up -d --build mock-backend mock-datasource-server`, {
      cwd: TEST_INTEGRATION_DIR,
      stdio: "inherit",
    });

    // 3. Poll for mock-backend (WireMock health), the datasource nginx (public CSV)
    //    and the datasource sshd (SSH banner) until all are ready. Two of the twelve
    //    happy-path feeds are SFTP, so the downloader container must not launch until
    //    sshd accepts connections, not just until HTTP answers.
    console.log("[Integration Test] Waiting for mock services to be ready...");
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        const [resBackend, resSupplier, sshReady] = await Promise.all([
          fetch(`http://${MOCK_HOST}:8089/__admin/health`),
          fetch(`http://${MOCK_HOST}:8088/public/feed_public_comma.csv`),
          sshdIsReady(MOCK_HOST),
        ]);
        if (resBackend.status === 200 && resSupplier.status === 200 && sshReady) {
          ready = true;
          break;
        }
      } catch {
        // Wait and retry
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!ready) {
      throw new Error("Mock services (WireMock or Nginx) failed to become ready within timeout.");
    }
    console.log("[Integration Test] Mock services are healthy and responding.");
  }, 120000);

  afterAll(() => {
    console.log("[Integration Test] Tearing down mock services...");
    try {
      execSync(`docker compose -f "${COMPOSE_FILE}" down`, {
        cwd: TEST_INTEGRATION_DIR,
        stdio: "inherit",
      });
    } catch {
      // Ignored during teardown
    }
  });

  const happyPathCases: Array<{ id: string; assertCsv: (content: string) => void }> = [
    {
      id: "conn_http_public_comma",
      assertCsv: (content) => {
        expect(content).toContain("PROD-001;Tool Set A;19.99;150");
      },
    },
    {
      id: "conn_http_pipe",
      assertCsv: (content) => {
        expect(content).toContain("PIPE-101;Heavy Hammer;12.99;80");
      },
    },
    {
      id: "conn_http_semicolon",
      assertCsv: (content) => {
        expect(content).toContain("SEMI-201;Screwdriver Set;15.00;95");
      },
    },
    {
      id: "conn_http_bearer",
      assertCsv: (content) => {
        expect(content).toContain("BEARER-301;Safety Goggles;6.50;500");
      },
    },
    {
      id: "conn_http_apikey",
      assertCsv: (content) => {
        expect(content).toContain("APIKEY-401;Cordless Screwdriver;45.00;30");
      },
    },
    {
      id: "conn_http_basic",
      assertCsv: (content) => {
        expect(content).toContain("BASIC-501;Toolbox Metal 3-Tier;38.50;25");
      },
    },
    {
      id: "conn_http_xml",
      assertCsv: (content) => {
        expect(content).toContain("XML-601");
        expect(content).toContain("Digital Caliper 150mm");
      },
    },
    {
      id: "conn_sftp_password",
      assertCsv: (content) => {
        expect(content).toContain("SFTP-701;Hex Key Set 9pc;14.50;110");
      },
    },
    {
      id: "conn_sftp_key",
      assertCsv: (content) => {
        expect(content).toContain("SFTP-701;Hex Key Set 9pc;14.50;110");
      },
    },
    {
      id: "conn_http_win1250",
      assertCsv: (content) => {
        expect(content).toContain("Cikkszám;Terméknév;Ár;Készlet");
        expect(content).toContain("HU-901;Árvíztűrő tükörfúrógép;14990;25");
        expect(content).toContain("HU-902;Ütvefúró és vésőgép;28500;10");
      },
    },
    {
      id: "conn_http_utf8_bom",
      assertCsv: (content) => {
        expect(content.charCodeAt(0)).not.toBe(0xfeff);
        expect(content).toContain("sku;megnevezés;ár;raktár");
        expect(content).toContain("BOM-101;Láncfűrész fém fogazattal;34990;12");
      },
    },
    {
      id: "conn_http_iso88592",
      assertCsv: (content) => {
        expect(content).toContain("Azonosító;Megnevezés;Egységár;Raktár");
        expect(content).toContain("ISO-001;Csavarhúzó készlet (9 részes);4500;85");
      },
    },
  ];

  describe("single-connection mapping runs (Happy Path)", () => {
    it.each(
      happyPathCases.map(
        ({ id, assertCsv }) => [id, assertCsv] as [string, (content: string) => void]
      )
    )("downloads and converts the one mapped connection %s", (id, assertCsv) => {
      cleanTempDir();

      const { exitCode, stdout, stderr } = runDownloaderContainer(baseEnv(id));

      console.log(`[Integration Test Output - ${id}]:\n` + stdout);
      // Embed the downloader's own output in the failure so a flaky/non-zero run is
      // self-diagnosing: the session summary + "Error processing connection ..." lines
      // name the exact connection that failed instead of vanishing with the temp dir.
      expect(
        exitCode,
        `downloader exited ${exitCode} (expected 0).\n--- stdout (tail) ---\n${stdout.slice(-8000)}${
          stderr ? `\n--- stderr (tail) ---\n${stderr.slice(-2000)}` : ""
        }`
      ).toBe(0);
      expect(stdout).toContain("Downloader completed successfully without errors");

      // The converted output must be exactly <connectionId>.csv (single-connection run).
      const csvPath = path.join(TEMP_DIR, `${id}.csv`);
      const files = fs.readdirSync(TEMP_DIR);
      expect(
        fs.existsSync(csvPath),
        `expected ${csvPath} to exist. temp/ contains: ${files.join(", ")}`
      ).toBe(true);
      assertCsv(fs.readFileSync(csvPath, "utf-8"));
    }, 60000);
  });

  const negativeCases: Array<{ id: string; label: string }> = [
    { id: "conn_malformed_xml", label: "Malformed XML" },
    { id: "conn_bad_bearer", label: "Bad Bearer token" },
    { id: "conn_bad_sftp", label: "Bad SFTP password" },
    { id: "conn_missing", label: "Connection not found (404)" },
    { id: "conn_inactive", label: "Inactive connection" },
  ];

  describe("negative single-connection runs", () => {
    it.each(negativeCases.map(({ id, label }) => [id, label] as [string, string]))(
      "%s exits 1 and logs the per-connection error (%s)",
      (id, label) => {
        cleanTempDir();

        const { exitCode, stdout, stderr } = runDownloaderContainer(baseEnv(id));

        console.log(`[Integration Test Output - ${label}]:\n` + stdout);
        expect(
          exitCode,
          `downloader exited ${exitCode} (expected 1).\n--- stdout (tail) ---\n${stdout.slice(-8000)}${
            stderr ? `\n--- stderr (tail) ---\n${stderr.slice(-2000)}` : ""
          }`
        ).toBe(1);
        expect(stdout).toContain("Downloader finished with errors");
        expect(stdout).toContain("Error processing connection");
      },
      60000
    );
  });
});
