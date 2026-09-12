import { Container } from "inversify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeUnasHttpClient } from "../../test/helpers/fake-unas-http-client.js";
import { registerUnasJsonClient } from "../di/register-unas-json-client.js";
import { TYPES } from "../types/binding-keys.js";
import type { IUnasJsonClient } from "./unas-json-client.interface.js";

const BASE = "http://test/shop/";
const LOGIN_OK = { status: 200, data: '<?xml version="1.0" encoding="UTF-8"?><Login><Token>tok-debug</Token></Login>' };

function setup(fake: FakeUnasHttpClient): IUnasJsonClient {
    const container = new Container();
    container.bind(TYPES.IUnasHttpClient).toConstantValue(fake);
    registerUnasJsonClient(container, { baseUrl: BASE, apiKey: "secret-api-key-12345" });
    return container.get<IUnasJsonClient>(TYPES.IUnasJsonClient);
}

describe("DEBUG_UNAS_JSON_CLIENT logging", () => {
    const originalEnv = process.env.DEBUG_UNAS_JSON_CLIENT;

    beforeEach(() => {
        vi.spyOn(console, "log").mockReturnValue(undefined);
    });

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.DEBUG_UNAS_JSON_CLIENT = originalEnv;
        } else {
            delete process.env.DEBUG_UNAS_JSON_CLIENT;
        }
        vi.restoreAllMocks();
    });

    it("does not log XML payloads when DEBUG_UNAS_JSON_CLIENT is not set", async () => {
        delete process.env.DEBUG_UNAS_JSON_CLIENT;
        const fake = new FakeUnasHttpClient();
        fake.enqueue(`${BASE}login`, LOGIN_OK);
        const client = setup(fake);

        await client.login();

        const debugLogs = (vi.mocked(console.log).mock.calls as [unknown, ...unknown[]][])
            .map(([msg]) => msg)
            .filter((msg): msg is string => typeof msg === "string" && msg.includes("[DEBUG_UNAS_JSON_CLIENT]"));

        expect(debugLogs).toHaveLength(0);
    });

    it("does not log when set to '0' or 'false'", async () => {
        for (const disabledVal of ["0", "false", "FALSE", " 0 "]) {
            process.env.DEBUG_UNAS_JSON_CLIENT = disabledVal;
            const fake = new FakeUnasHttpClient();
            fake.enqueue(`${BASE}login`, LOGIN_OK);
            const client = setup(fake);

            await client.login();

            const debugLogs = (vi.mocked(console.log).mock.calls as [unknown, ...unknown[]][])
                .map(([msg]) => msg)
                .filter((msg): msg is string => typeof msg === "string" && msg.includes("[DEBUG_UNAS_JSON_CLIENT]"));

            expect(debugLogs).toHaveLength(0);
        }
    });

    it("logs request and response XML with URLs and masks apiKey when set to 'true'", async () => {
        process.env.DEBUG_UNAS_JSON_CLIENT = "true";
        const fake = new FakeUnasHttpClient();
        fake.enqueue(`${BASE}login`, LOGIN_OK);
        const client = setup(fake);

        await client.login();

        const debugLogs = (vi.mocked(console.log).mock.calls as [unknown, ...unknown[]][])
            .map(([msg]) => msg)
            .filter((msg): msg is string => typeof msg === "string" && msg.includes("[DEBUG_UNAS_JSON_CLIENT]"));

        expect(debugLogs.length).toBeGreaterThanOrEqual(2);

        // Verify request log
        const requestLog = debugLogs.find((l) => l.includes(">>> REQUEST to:"));
        expect(requestLog).toBeDefined();
        expect(requestLog).toContain(`${BASE}login`);
        expect(requestLog).toContain("<ApiKey>***REDACTED***</ApiKey>");
        expect(requestLog).not.toContain("secret-api-key-12345");

        // Verify response log
        const responseLog = debugLogs.find((l) => l.includes("<<< RESPONSE from:"));
        expect(responseLog).toBeDefined();
        expect(responseLog).toContain(`${BASE}login`);
        expect(responseLog).toContain("(Status: 200)");
        expect(responseLog).toContain("<Token>tok-debug</Token>");
    });

    it("logs request and response when set to '1'", async () => {
        process.env.DEBUG_UNAS_JSON_CLIENT = "1";
        const fake = new FakeUnasHttpClient();
        fake.enqueue(`${BASE}login`, LOGIN_OK);
        const client = setup(fake);

        await client.login();

        const debugLogs = (vi.mocked(console.log).mock.calls as [unknown, ...unknown[]][])
            .map(([msg]) => msg)
            .filter((msg): msg is string => typeof msg === "string" && msg.includes("[DEBUG_UNAS_JSON_CLIENT]"));

        expect(debugLogs.length).toBeGreaterThanOrEqual(2);
        expect(debugLogs.some((l) => l.includes(">>> REQUEST to:"))).toBe(true);
        expect(debugLogs.some((l) => l.includes("<<< RESPONSE from:"))).toBe(true);
    });

    it("logs response even on non-200 HTTP error", async () => {
        process.env.DEBUG_UNAS_JSON_CLIENT = "true";
        const fake = new FakeUnasHttpClient();
        fake.enqueue(`${BASE}login`, { status: 400, data: "<Error>Bad login request</Error>" });
        const client = setup(fake);

        await expect(client.login()).rejects.toThrow();

        const debugLogs = (vi.mocked(console.log).mock.calls as [unknown, ...unknown[]][])
            .map(([msg]) => msg)
            .filter((msg): msg is string => typeof msg === "string" && msg.includes("[DEBUG_UNAS_JSON_CLIENT]"));

        const responseLog = debugLogs.find((l) => l.includes("<<< RESPONSE from:"));
        expect(responseLog).toBeDefined();
        expect(responseLog).toContain("(Status: 400)");
        expect(responseLog).toContain("<Error>Bad login request</Error>");
    });
});
