import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Integration is split out; the downloader.integration.test.ts file under test/integration
    // runs via `test:integration` only (mirrors the processor layout).
    exclude: ["node_modules", "dist", "temp", "test/integration/**"],
    environment: "node",
  },
});
