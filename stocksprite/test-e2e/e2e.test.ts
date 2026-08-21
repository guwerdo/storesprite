import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const COMPOSE_FILE = path.resolve(__dirname, "docker-compose-test-e2e.yaml");
const ROOT_DIR = path.resolve(__dirname, "..");
const TEST_E2E_DIR = __dirname;
const TEMP_DIR = path.resolve(__dirname, "temp");

function cleanTempDir(): void {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function runDownloaderContainer(userId: string): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "storesprite-e2e-net",
      "-e",
      `USER_ID=${userId}`,
      "-e",
      "WORKER_TOKEN=mock_worker_token",
      "-e",
      "BACKEND_URL=http://mock-backend:8080",
      "-e",
      "OUTPUT_DIR=/app/temp",
      "-v",
      `${TEMP_DIR}:/app/temp`,
      "storesprite-downloader:test-e2e",
    ],
    {
      encoding: "utf-8",
      cwd: ROOT_DIR,
    }
  );

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

describe("StoreSprite Downloader Container E2E Test Suite", () => {
  beforeAll(async () => {
    cleanTempDir();

    // 1. Build production image for test
    console.log("[E2E] Building production storesprite-downloader image...");
    execSync("docker build -t storesprite-downloader:test-e2e .", {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });

    // 2. Start mock-backend and mock-datasource-server services
    console.log("[E2E] Starting mock-backend and mock-datasource-server services via docker-compose...");
    execSync(`docker compose -f "${COMPOSE_FILE}" up -d --build mock-backend mock-datasource-server`, {
      cwd: TEST_E2E_DIR,
      stdio: "inherit",
    });

    // 3. Poll for mock-backend and mock-datasource-server readiness
    console.log("[E2E] Waiting for mock services to be ready...");
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const [resBackend, resSupplier] = await Promise.all([
          fetch("http://127.0.0.1:8089/__admin/health"),
          fetch("http://127.0.0.1:8088/public/feed_public_comma.csv"),
        ]);
        if (resBackend.status === 200 && resSupplier.status === 200) {
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
    console.log("[E2E] Mock services are healthy and responding.");
  }, 120000);

  afterAll(() => {
    console.log("[E2E] Tearing down mock services...");
    try {
      execSync(`docker compose -f "${COMPOSE_FILE}" down`, {
        cwd: TEST_E2E_DIR,
        stdio: "inherit",
      });
    } catch {
      // Ignored during teardown
    }
  });

  it("should successfully download and standardize all 9 protocols/auth combinations (Happy Path)", () => {
    cleanTempDir();

    const { exitCode, stdout } = runDownloaderContainer("test_user_all_protocols");

    console.log("[E2E Output - Happy Path]:\n" + stdout);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Downloader completed successfully without errors");

    // Verify all 9 CSV files exist in temp/
    const files = fs.readdirSync(TEMP_DIR);
    console.log("[E2E Downloaded Files]:", files);

    // 1. HTTP Public Comma
    const publicComma = files.find((f) => f.includes("conn_http_public_comma") && f.endsWith(".csv"));
    expect(publicComma).toBeDefined();
    const publicCommaContent = fs.readFileSync(path.join(TEMP_DIR, publicComma!), "utf-8");
    expect(publicCommaContent).toContain("PROD-001;Tool Set A;19.99;150");

    // 2. HTTP Pipe Delimited -> Standardized to Semicolon
    const pipeFile = files.find((f) => f.includes("conn_http_pipe") && f.endsWith(".csv"));
    expect(pipeFile).toBeDefined();
    const pipeContent = fs.readFileSync(path.join(TEMP_DIR, pipeFile!), "utf-8");
    expect(pipeContent).toContain("PIPE-101;Heavy Hammer;12.99;80");

    // 3. HTTP Semicolon Delimited
    const semiFile = files.find((f) => f.includes("conn_http_semicolon") && f.endsWith(".csv"));
    expect(semiFile).toBeDefined();
    const semiContent = fs.readFileSync(path.join(TEMP_DIR, semiFile!), "utf-8");
    expect(semiContent).toContain("SEMI-201;Screwdriver Set;15.00;95");

    // 4. HTTP Bearer Auth
    const bearerFile = files.find((f) => f.includes("conn_http_bearer") && f.endsWith(".csv"));
    expect(bearerFile).toBeDefined();
    const bearerContent = fs.readFileSync(path.join(TEMP_DIR, bearerFile!), "utf-8");
    expect(bearerContent).toContain("BEARER-301;Safety Goggles;6.50;500");

    // 5. HTTP API Key Header Auth
    const apikeyFile = files.find((f) => f.includes("conn_http_apikey") && f.endsWith(".csv"));
    expect(apikeyFile).toBeDefined();
    const apikeyContent = fs.readFileSync(path.join(TEMP_DIR, apikeyFile!), "utf-8");
    expect(apikeyContent).toContain("APIKEY-401;Cordless Screwdriver;45.00;30");

    // 6. HTTP Basic Auth
    const basicFile = files.find((f) => f.includes("conn_http_basic") && f.endsWith(".csv"));
    expect(basicFile).toBeDefined();
    const basicContent = fs.readFileSync(path.join(TEMP_DIR, basicFile!), "utf-8");
    expect(basicContent).toContain("BASIC-501;Toolbox Metal 3-Tier;38.50;25");

    // 7. HTTP XML Product Feed converted to CSV
    const xmlFile = files.find((f) => f.includes("conn_http_xml") && f.endsWith(".csv"));
    expect(xmlFile).toBeDefined();
    const xmlContent = fs.readFileSync(path.join(TEMP_DIR, xmlFile!), "utf-8");
    expect(xmlContent).toContain("XML-601");
    expect(xmlContent).toContain("Digital Caliper 150mm");

    // 8. SFTP Password Auth
    const sftpPassFile = files.find((f) => f.includes("conn_sftp_password") && f.endsWith(".csv"));
    expect(sftpPassFile).toBeDefined();
    const sftpPassContent = fs.readFileSync(path.join(TEMP_DIR, sftpPassFile!), "utf-8");
    expect(sftpPassContent).toContain("SFTP-701;Hex Key Set 9pc;14.50;110");

    // 9. SFTP SSH Key Auth
    const sftpKeyFile = files.find((f) => f.includes("conn_sftp_key") && f.endsWith(".csv"));
    expect(sftpKeyFile).toBeDefined();
    const sftpKeyContent = fs.readFileSync(path.join(TEMP_DIR, sftpKeyFile!), "utf-8");
    expect(sftpKeyContent).toContain("SFTP-701;Hex Key Set 9pc;14.50;110");
  }, 60000);

  it("should catch and gracefully handle malformed XML feeds (Negative Test)", () => {
    cleanTempDir();

    const { exitCode, stdout } = runDownloaderContainer("test_user_malformed");

    console.log("[E2E Output - Malformed XML]:\n" + stdout);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("Error processing connection");
    expect(stdout).toContain("Downloader finished with errors");
  }, 30000);

  it("should catch and gracefully report invalid authentication failures (Negative Test)", () => {
    cleanTempDir();

    const { exitCode, stdout } = runDownloaderContainer("test_user_bad_auth");

    console.log("[E2E Output - Bad Auth]:\n" + stdout);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("Error processing connection");
    expect(stdout).toContain("Downloader finished with errors");
  }, 30000);

  it("should fail immediately with exit code 1 when backend returns 404 User Not Found (Negative Test)", () => {
    cleanTempDir();

    const { exitCode, stdout } = runDownloaderContainer("non_existing_user");

    console.log("[E2E Output - 404 User]:\n" + stdout);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("Fatal exception during downloader execution");
  }, 30000);
});
