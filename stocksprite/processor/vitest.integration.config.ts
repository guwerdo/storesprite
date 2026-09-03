import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        env: { NODE_ENV: "test", VITEST: "true" },
        include: ["./test/integration/**/*.test.ts"],
        setupFiles: ["./test/setup.ts"],
        globals: true,
        testTimeout: 60000,
        hookTimeout: 60000,
    },
});
