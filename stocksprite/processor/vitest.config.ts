import { defineConfig } from "vitest/config";

export default defineConfig({
    server: {
        watch: {
            usePolling: true, // Essential for Docker/Network volumes:
            interval: 100,
            ignored: ["**/node_modules/**", "**/dist/**", "**/temp/**"],
        },
    },
    test: {
        environment: "node",
        env: {
            NODE_ENV: "test",
            VITEST: "true",
        },
        // Colocated unit tests in src + the end-to-end CSV→XML scenarios under test/integration.
        include: ["./src/**/*.test.ts", "./src/**/*.spec.ts", "./test/integration/**/*.test.ts"],
        setupFiles: ["./test/setup.ts"],
        // Integration runs real HTTP against an in-process UNAS server and real CSV parsing.
        testTimeout: 60000,
        hookTimeout: 60000,
        globals: true,
        typecheck: {
            enabled: false, // use `tsc` separately
        },
    },
});
