import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.ts"],
    exclude: ["node_modules", "dist", "temp"],
    environment: "node",
    testTimeout: 180000,
    hookTimeout: 180000,
  },
});
