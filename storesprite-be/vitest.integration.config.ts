import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://storesprite:storesprite_secure_pass@postgres:5432/storesprite_test_db",
      PGDATABASE: "storesprite_test_db",
      INTERNAL_TOKEN: "mock_internal_token",
      INTERNAL_BACKEND_URL: "http://storesprite-be:3000",
    },
  },
});
