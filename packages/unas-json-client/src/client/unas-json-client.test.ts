import { Container } from "inversify";
import { describe, expect, it } from "vitest";
import { FakeUnasHttpClient } from "../../test/helpers/fake-unas-http-client.js";
import { registerUnasJsonClient } from "../di/register-unas-json-client.js";
import { TYPES } from "../types/binding-keys.js";
import { UnasAuthError } from "../types/errors.js";
import type { IUnasJsonClient } from "./unas-json-client.interface.js";

const BASE = "http://test/shop/";
const LOGIN_OK = { status: 200, data: '<?xml version="1.0" encoding="UTF-8"?><Login><Token>tok-1</Token></Login>' };

function setup(fake: FakeUnasHttpClient): IUnasJsonClient {
    const container = new Container();
    container.bind(TYPES.IUnasHttpClient).toConstantValue(fake);
    registerUnasJsonClient(container, { baseUrl: BASE, apiKey: "test-key" });
    return container.get<IUnasJsonClient>(TYPES.IUnasJsonClient);
}

describe("UnasJsonClient", () => {
    it("logs in and returns the token without an Authorization header", async () => {
        const fake = new FakeUnasHttpClient();
        fake.enqueue(`${BASE}login`, LOGIN_OK);
        const client = setup(fake);

        const token = await client.login();
        expect(token).toBe("tok-1");
        expect(fake.requests).toHaveLength(1);
        expect(fake.requests[0].headers).toBeUndefined();
    });

    it("sends a Bearer header for an authenticated request", async () => {
        const fake = new FakeUnasHttpClient();
        fake.enqueue(`${BASE}login`, LOGIN_OK);
        fake.enqueue(`${BASE}getWarehouse`, {
            status: 200,
            data: "<Warehouses><Warehouse><Id>1</Id><Name>N</Name><PublicName>P</PublicName></Warehouse></Warehouses>",
        });
        const client = setup(fake);

        const warehouses = await client.getWarehouse();
        expect(warehouses).toEqual([{ id: 1, name: "N", publicName: "P" }]);
        expect(fake.requests[1].headers).toEqual({ Authorization: "Bearer tok-1" });
    });

    it("refreshes an expired token and retries once", async () => {
        const fake = new FakeUnasHttpClient();
        fake.enqueue(`${BASE}login`, LOGIN_OK);
        fake.enqueue(`${BASE}getProductDB`, { status: 400, data: "<Error>expired</Error>" });
        fake.enqueue(`${BASE}login`, { status: 200, data: '<?xml version="1.0" encoding="UTF-8"?><Login><Token>tok-2</Token></Login>' });
        fake.enqueue(`${BASE}getProductDB`, { status: 200, data: "<getProductDB><Url>http://x/csv</Url></getProductDB>" });
        const client = setup(fake);

        const url = await client.getProductDB();
        expect(url).toBe("http://x/csv");
        expect(fake.requests.filter((r) => r.url === `${BASE}login`)).toHaveLength(2);
        expect(fake.requests.filter((r) => r.url === `${BASE}getProductDB`)).toHaveLength(2);
        expect(fake.requests[3].headers).toEqual({ Authorization: "Bearer tok-2" });
    });

    it("throws UnasAuthError when the retry still fails", async () => {
        const fake = new FakeUnasHttpClient();
        fake.enqueue(`${BASE}login`, LOGIN_OK);
        fake.enqueue(`${BASE}getProductDB`, { status: 400, data: "<Error>expired</Error>" });
        fake.enqueue(`${BASE}login`, LOGIN_OK);
        fake.enqueue(`${BASE}getProductDB`, { status: 400, data: "<Error>still bad</Error>" });
        const client = setup(fake);

        await expect(client.getProductDB()).rejects.toThrow(UnasAuthError);
    });
});
