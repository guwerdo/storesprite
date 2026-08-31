import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  userId: string;
  internalToken: string;
  backendUrl: string;
  outputDir: string;
  testConnectionId?: string;
}

export function getAppConfig(): AppConfig {
  const userId = process.env.USER_ID?.trim();
  if (!userId) {
    throw new Error("Missing required environment variable: USER_ID");
  }

  const internalToken = process.env.INTERNAL_TOKEN?.trim();
  if (!internalToken && process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variable: INTERNAL_TOKEN");
  }
  const backendUrl = (process.env.BACKEND_URL?.trim() || "http://storesprite-be:3000").replace(/\/+$/, "");
  const outputDir = process.env.OUTPUT_DIR?.trim() || path.resolve(process.cwd(), "temp");
  const testConnectionId = process.env.TEST_CONNECTION?.trim() || undefined;

  return {
    userId,
    internalToken: internalToken || "mock_internal_token",
    backendUrl,
    outputDir,
    testConnectionId,
  };
}
