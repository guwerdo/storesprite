import { describe, expect, it } from "vitest";
import { createUnasJsonClient } from "../../src/index.js";

const baseUrl = process.env.UNAS_BASE_URL;
const apiKey = process.env.UNAS_API_KEY;
const enabled = process.env.UNAS_E2E === "1" && !!baseUrl && !!apiKey;

// Self-skips unless UNAS_E2E=1 UNAS_BASE_URL=… UNAS_API_KEY=… (run manually against a sandbox shop).
describe.skipIf(!enabled)("UNAS live API (e2e)", () => {
    it("logs in and lists warehouses", async () => {
        const client = createUnasJsonClient({ baseUrl: baseUrl!, apiKey: apiKey! });
        const token = await client.login();
        expect(token).toBeTruthy();
        const warehouses = await client.getWarehouse();
        expect(Array.isArray(warehouses)).toBe(true);
    });
});
