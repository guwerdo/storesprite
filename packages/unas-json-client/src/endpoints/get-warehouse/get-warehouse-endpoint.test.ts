import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../test/helpers/load-fixture.js";
import { FastXmlService } from "../../xml/fast-xml-service.js";
import { GetWarehouseEndpoint } from "./get-warehouse-endpoint.js";

describe("GetWarehouseEndpoint", () => {
    const endpoint = new GetWarehouseEndpoint(new FastXmlService());

    it("has no request body", () => {
        expect(endpoint.buildRequest()).toBeUndefined();
    });

    it("parses warehouses", () => {
        const warehouses = endpoint.parseResponse(loadFixture("responses", "getWarehouse-response.xml"));
        expect(warehouses).toEqual([
            { id: 5726549, name: "Czech warehouse", publicName: "Czech warehouse" },
            { id: 5726554, name: "English warehouse", publicName: "English warehouse" },
        ]);
    });

    it("returns an empty array for no warehouses", () => {
        expect(endpoint.parseResponse("<Warehouses></Warehouses>")).toEqual([]);
    });
});
