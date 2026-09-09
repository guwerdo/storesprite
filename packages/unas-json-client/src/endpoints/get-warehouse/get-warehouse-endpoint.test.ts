import { describe, expect, it } from "vitest";
import { loadFixture } from "../../../test/helpers/load-fixture.js";
import { FastXmlService } from "../../xml/fast-xml-service.js";
import { GetWarehouseEndpoint } from "./get-warehouse-endpoint.js";

describe("GetWarehouseEndpoint", () => {
    const endpoint = new GetWarehouseEndpoint(new FastXmlService());

    it("has no request body when request is omitted", () => {
        // Act & Assert
        expect(endpoint.buildRequest()).toBeUndefined();
    });

    it("builds Params request XML when filter params are provided", () => {
        // Arrange
        const request = { name: "Raktár 1", id: 4590241 };

        // Act
        const xml = endpoint.buildRequest(request);

        // Assert
        expect(xml).toContain("<Params>");
        expect(xml).toContain("<Id>4590241</Id>");
        expect(xml).toContain("<Name>Raktár 1</Name>");
    });

    it("parses warehouses from standard fixture", () => {
        // Act
        const warehouses = endpoint.parseResponse(loadFixture("responses", "getWarehouse-response.xml"));

        // Assert
        expect(warehouses).toEqual([
            {
                id: 5726549,
                name: "Czech warehouse",
                publicName: "Czech warehouse",
                active: undefined,
                info: undefined,
                order: undefined,
                syncMainStockDisabled: undefined,
                type: undefined,
                useFilter: undefined,
                visibleOnProductDetails: undefined,
            },
            {
                id: 5726554,
                name: "English warehouse",
                publicName: "English warehouse",
                active: undefined,
                info: undefined,
                order: undefined,
                syncMainStockDisabled: undefined,
                type: undefined,
                useFilter: undefined,
                visibleOnProductDetails: undefined,
            },
        ]);
    });

    it("parses warehouses with full metadata and trims CDATA whitespace", () => {
        // Arrange
        const rawXml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>5726549</Id>
        <Active>yes</Active>
        <Name>
            <![CDATA[Cseh raktár (Cromwell)]]>
        </Name>
        <PublicName>
            <![CDATA[Központi magyar raktár]]>
        </PublicName>
        <Info>
            <![CDATA[Kiszállítás vagy személyes átvétel: 5 munkanap]]>
        </Info>
        <Order>1</Order>
        <Type>external</Type>
        <SyncMainStockDisabled>no</SyncMainStockDisabled>
        <VisibleOnProductDetails>only_if_on_stock</VisibleOnProductDetails>
        <UseFilter>no</UseFilter>
    </Warehouse>
</Warehouses>`;

        // Act
        const warehouses = endpoint.parseResponse(rawXml);

        // Assert
        expect(warehouses).toHaveLength(1);
        expect(warehouses[0]).toEqual({
            id: 5726549,
            name: "Cseh raktár (Cromwell)",
            publicName: "Központi magyar raktár",
            info: "Kiszállítás vagy személyes átvétel: 5 munkanap",
            order: 1,
            type: "external",
            active: "yes",
            syncMainStockDisabled: "no",
            visibleOnProductDetails: "only_if_on_stock",
            useFilter: "no",
        });
    });

    it("returns an empty array for no warehouses", () => {
        // Act & Assert
        expect(endpoint.parseResponse("<Warehouses></Warehouses>")).toEqual([]);
    });
});
