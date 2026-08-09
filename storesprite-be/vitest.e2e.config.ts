import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.test.ts"],
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://storesprite:storesprite_secure_pass@postgres:5432/storesprite_test_db",
      PGDATABASE: "storesprite_test_db",
    },
  },
});
