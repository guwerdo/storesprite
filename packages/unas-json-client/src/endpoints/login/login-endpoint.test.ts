import { describe, expect, it } from "vitest";
import { loadFixture, normalizeXml } from "../../../test/helpers/load-fixture.js";
import { FastXmlService } from "../../xml/fast-xml-service.js";
import { LoginEndpoint } from "./login-endpoint.js";

describe("LoginEndpoint", () => {
    const endpoint = new LoginEndpoint(new FastXmlService());

    it("builds the login XML without WebshopInfo by default", () => {
        const xml = endpoint.buildRequest({ apiKey: "test-key" });
        expect(normalizeXml(xml)).toBe(normalizeXml(loadFixture("requests", "login.xml")));
    });

    it("builds the login XML with WebshopInfo when requested", () => {
        const xml = endpoint.buildRequest({ apiKey: "test-key", webshopInfo: true });
        expect(normalizeXml(xml)).toBe(normalizeXml(loadFixture("requests", "login-webshopinfo.xml")));
    });

    it("parses the full login response", () => {
        const response = endpoint.parseResponse(loadFixture("responses", "login-response.xml"));
        expect(response.token).toBe("tok-123");
        expect(response.expire).toBe("2026.08.26 13:21:26");
        expect(response.expireTime).toBe(1787743286);
        expect(response.shopId).toBe(83219);
        expect(response.subscription).toBe("vip-100000");
        expect(response.status).toBe("ok");
        expect(response.permissions).toHaveLength(45);
        expect(response.permissions[0]).toBe("getOrder");
        expect(response.permissions).toContain("setPackageOffer");
        expect(response.webshopInfo).toBeUndefined();
    });

    it("parses the login response with webshop info", () => {
        const response = endpoint.parseResponse(loadFixture("responses", "login-response-webshopinfo.xml"));
        expect(response.token).toBe("tok-123");
        expect(response.webshopInfo?.webshopName).toBe("Ezermesterszerszám");
        expect(response.webshopInfo?.webshopUrl).toBe("www.ezermesterszerszam.hu");
        expect(response.webshopInfo?.contact).toEqual({
            name: "Agro Garden Kft.",
            email: "webshop@agrogarden.hu",
            phone: "+36-70/434-1115",
            mobile: "+36704341115",
        });
        expect(response.webshopInfo?.trader.vat).toBe("14743977-2-13");
        expect(response.webshopInfo?.trader.iban).toBe("HU92117421802007080900000000");
        expect(response.webshopInfo?.languages).toEqual([{ code: "hu", default: "yes" }]);
    });

    it("throws when the token is missing", () => {
        expect(() => endpoint.parseResponse("<Login><Status>ok</Status></Login>")).toThrow();
    });
});
