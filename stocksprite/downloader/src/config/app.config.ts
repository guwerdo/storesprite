import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  userId: string;
  workerToken: string;
  backendUrl: string;
  outputDir: string;
}

export function getAppConfig(): AppConfig {
  const userId = process.env.USER_ID?.trim();
  if (!userId) {
    throw new Error("Missing required environment variable: USER_ID");
  }

  const workerToken = process.env.WORKER_TOKEN?.trim() || "mock_worker_token";
  const backendUrl = (process.env.BACKEND_URL?.trim() || "http://storesprite-be:3000").replace(/\/+$/, "");
  const outputDir = process.env.OUTPUT_DIR?.trim() || path.resolve(process.cwd(), "temp");

  return {
    userId,
    workerToken,
    backendUrl,
    outputDir,
  };
}
