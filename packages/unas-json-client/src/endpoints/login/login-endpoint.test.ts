import { describe, expect, it } from "vitest";
import { loadFixture, normalizeXml } from "../../../test/helpers/load-fixture.js";
import { FastXmlService } from "../../xml/fast-xml-service.js";
import { LoginEndpoint } from "./login-endpoint.js";

describe("LoginEndpoint", () => {
    const endpoint = new LoginEndpoint(new FastXmlService());

    it("builds the login XML with WebshopInfo true by default", () => {
        const xml = endpoint.buildRequest({ apiKey: "test-key" });
        expect(normalizeXml(xml)).toBe(normalizeXml(loadFixture("requests", "login.xml")));
    });

    it("parses the token", () => {
        const response = endpoint.parseResponse(loadFixture("responses", "login-response.xml"));
        expect(response.token).toBe("tok-123");
    });

    it("throws when the token is missing", () => {
        expect(() => endpoint.parseResponse("<Login><Status>ok</Status></Login>")).toThrow();
    });
});
