import { defineConfig } from "vitest/config";

export default defineConfig({
    server: {
        watch: {
            usePolling: true, // Essential for Docker/Network volumes:
            interval: 100, // Interval in milliseconds (adjust if CPU usage is too high)
            ignored: ["!**/src/**", "**/node_modules/**", "**/dist/**", "**/build/**"],
        },
    },
    test: {
        environment: "node",
        env: {
            NODE_ENV: "test",
            VITEST: "true",
        },
        // Pick up *.test.ts and *.spec.ts
        include: ["./src/**/*.test.ts", "./src/**/*.spec.ts"],

        // Same as Jest's globals (describe, it, expect)
        globals: true,

        // Respect your Node ESM + tsconfig setup
        typecheck: {
            enabled: false, // use `tsc --noEmit` separately
        },
    },
});
