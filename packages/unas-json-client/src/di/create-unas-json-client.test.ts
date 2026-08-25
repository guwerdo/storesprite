import { describe, expect, it } from "vitest";
import { FakeUnasHttpClient } from "../../test/helpers/fake-unas-http-client.js";
import { createUnasJsonClient } from "./create-unas-json-client.js";

describe("createUnasJsonClient", () => {
    it("returns a working client with an injected HTTP client", async () => {
        const fake = new FakeUnasHttpClient();
        fake.enqueue("http://test/shop/login", {
            status: 200,
            data: '<?xml version="1.0" encoding="UTF-8"?><Login><Token>tok</Token></Login>',
        });
        fake.enqueue("http://test/shop/getWarehouse", {
            status: 200,
            data: "<Warehouses><Warehouse><Id>1</Id><Name>N</Name><PublicName>P</PublicName></Warehouse></Warehouses>",
        });

        const client = createUnasJsonClient({ baseUrl: "http://test/shop/", apiKey: "k" }, { httpClient: fake });
        const warehouses = await client.getWarehouse();
        expect(warehouses).toEqual([{ id: 1, name: "N", publicName: "P" }]);
    });

    it("honors a pre-populated token store and skips login", async () => {
        const fake = new FakeUnasHttpClient();
        fake.enqueue("http://test/shop/getWarehouse", {
            status: 200,
            data: "<Warehouses><Warehouse><Id>1</Id><Name>N</Name><PublicName>P</PublicName></Warehouse></Warehouses>",
        });
        const tokenStore = { get: () => Promise.resolve("pre-tok"), set: () => Promise.resolve() };

        const client = createUnasJsonClient(
            { baseUrl: "http://test/shop/", apiKey: "k" },
            { httpClient: fake, tokenStore },
        );

        const warehouses = await client.getWarehouse();
        expect(warehouses).toHaveLength(1);
        expect(fake.requests).toHaveLength(1);
        expect(fake.requests[0].headers).toEqual({ Authorization: "Bearer pre-tok" });
    });
});
