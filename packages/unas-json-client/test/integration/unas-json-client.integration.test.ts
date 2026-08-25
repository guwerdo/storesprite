import { afterEach, describe, expect, it } from "vitest";
import { createUnasJsonClient } from "../../src/index.js";
import { loadFixture, normalizeXml } from "../helpers/load-fixture.js";
import { startTestHttpServer, type ITestHttpServer } from "../helpers/test-http-server.js";

describe("unas-json-client integration", () => {
    let server: ITestHttpServer;

    afterEach(async () => {
        await server?.close();
    });

    it("sends the golden login + setProduct XML over real HTTP", async () => {
        server = await startTestHttpServer((request) => {
            if (request.url.endsWith("/login")) {
                return { status: 200, body: loadFixture("responses", "login-response.xml") };
            }
            if (request.url.endsWith("/setProduct")) {
                return { status: 200, body: loadFixture("responses", "setProduct-response-ok.xml") };
            }
            return { status: 404, body: "<Error>not found</Error>" };
        });

        const client = createUnasJsonClient({ baseUrl: server.baseUrl, apiKey: "test-key" });
        const products = await client.setProduct({
            products: [{ sku: "KEN5824600K", stocks: [{ quantity: 11 }, { warehouseId: 5726549, quantity: 22 }] }],
        });

        expect(products).toEqual([{ id: "1340633016", sku: "KEN5824600K", action: "modify", status: "ok" }]);
        expect(server.requests).toHaveLength(2);

        const [loginRequest, setProductRequest] = server.requests;
        expect(normalizeXml(loginRequest.body)).toBe(normalizeXml(loadFixture("requests", "login.xml")));
        expect(normalizeXml(setProductRequest.body)).toBe(normalizeXml(loadFixture("requests", "setProduct-modify.xml")));
        expect(setProductRequest.headers.authorization).toBe("Bearer tok-123");
    });

    it("gets warehouses over real HTTP", async () => {
        server = await startTestHttpServer((request) => {
            if (request.url.endsWith("/login")) {
                return { status: 200, body: loadFixture("responses", "login-response.xml") };
            }
            if (request.url.endsWith("/getWarehouse")) {
                return { status: 200, body: loadFixture("responses", "getWarehouse-response.xml") };
            }
            return { status: 404, body: "<Error>not found</Error>" };
        });

        const client = createUnasJsonClient({ baseUrl: server.baseUrl, apiKey: "test-key" });
        const warehouses = await client.getWarehouse();
        expect(warehouses).toHaveLength(2);
        expect(warehouses[0].id).toBe(5726549);
    });
});
