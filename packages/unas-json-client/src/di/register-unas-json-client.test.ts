import { Container } from "inversify";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";
import type { IUnasJsonClient } from "../client/unas-json-client.interface.js";
import type { ILogger } from "../core/logger.interface.js";
import type { IUnasEndpoint } from "../core/unas-endpoint.interface.js";
import { TYPES } from "../types/binding-keys.js";
import { registerUnasJsonClient } from "./register-unas-json-client.js";

describe("registerUnasJsonClient", () => {
    it("binds the client with defaults", () => {
        const container = new Container();
        registerUnasJsonClient(container, { baseUrl: "http://test/shop/", apiKey: "k" });
        expect(container.isBound(TYPES.IUnasJsonClient)).toBe(true);
        expect(container.get<IUnasJsonClient>(TYPES.IUnasJsonClient)).toBeDefined();
    });

    it("lets a pre-bound override win", () => {
        const container = new Container();
        const fakeLogger = mock<ILogger>();
        container.bind(TYPES.ILogger).toConstantValue(fakeLogger);
        registerUnasJsonClient(container, { baseUrl: "http://test/shop/", apiKey: "k" });
        expect(container.get<ILogger>(TYPES.ILogger)).toBe(fakeLogger);
    });

    it("picks up a custom endpoint bound to the endpoint registry", () => {
        const container = new Container();
        const customEndpoint: IUnasEndpoint = {
            name: "custom",
            requiresAuth: false,
            buildRequest: () => undefined,
            parseResponse: () => "ok",
        };
        container.bind<IUnasEndpoint>(TYPES.UnasEndpoint).toConstantValue(customEndpoint);
        registerUnasJsonClient(container, { baseUrl: "http://test/shop/", apiKey: "k" });
        expect(container.get<IUnasJsonClient>(TYPES.IUnasJsonClient)).toBeDefined();
    });
});
