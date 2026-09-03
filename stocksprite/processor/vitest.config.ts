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
        // Unit tests only; the end-to-end CSV→XML scenarios under test/integration run via `test:integration`.
        include: ["./test/**/*.test.ts"],
        exclude: ["node_modules", "dist", "temp", "./test/integration/**"],
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
