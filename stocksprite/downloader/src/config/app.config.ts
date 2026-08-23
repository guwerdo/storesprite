import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  userId: string;
  workerToken: string;
  backendUrl: string;
  outputDir: string;
  testConnectionId?: string;
}

export function getAppConfig(): AppConfig {
  const userId = process.env.USER_ID?.trim();
  if (!userId) {
    throw new Error("Missing required environment variable: USER_ID");
  }

  const workerToken = process.env.WORKER_TOKEN?.trim();
  if (!workerToken && process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: WORKER_TOKEN");
  }
  const backendUrl = (process.env.BACKEND_URL?.trim() || "http://storesprite-be:3000").replace(/\/+$/, "");
  const outputDir = process.env.OUTPUT_DIR?.trim() || path.resolve(process.cwd(), "temp");
  const testConnectionId = process.env.TEST_CONNECTION?.trim() || undefined;

  return {
    userId,
    workerToken: workerToken || "mock_worker_token",
    backendUrl,
    outputDir,
    testConnectionId,
  };
}
