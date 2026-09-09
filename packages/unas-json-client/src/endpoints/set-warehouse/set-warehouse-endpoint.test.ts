import { describe, expect, it } from "vitest";
import { FastXmlService } from "../../xml/fast-xml-service.js";
import { SetWarehouseEndpoint } from "./set-warehouse-endpoint.js";

describe("SetWarehouseEndpoint", () => {
    const endpoint = new SetWarehouseEndpoint(new FastXmlService());

    describe("buildRequest", () => {
        it("builds add warehouse request with CDATA and normalized fields", () => {
            // Arrange
            const request = {
                warehouses: [
                    {
                        name: "Test Warehouse",
                        publicName: "Public Test",
                        info: "5 munkanap",
                        order: 4,
                        type: "external" as const,
                        active: true,
                        syncMainStockDisabled: false,
                        visibleOnProductDetails: "only_if_on_stock" as const,
                        useFilter: true,
                    },
                ],
            };

            // Act
            const xml = endpoint.buildRequest(request);

            // Assert
            expect(xml).toContain("<Action>add</Action>");
            expect(xml).toContain("<Active>yes</Active>");
            expect(xml).toContain("<![CDATA[Test Warehouse]]>");
            expect(xml).toContain("<![CDATA[Public Test]]>");
            expect(xml).toContain("<![CDATA[5 munkanap]]>");
            expect(xml).toContain("<Order>4</Order>");
            expect(xml).toContain("<Type>external</Type>");
            expect(xml).toContain("<SyncMainStockDisabled>no</SyncMainStockDisabled>");
            expect(xml).toContain("<VisibleOnProductDetails>only_if_on_stock</VisibleOnProductDetails>");
            expect(xml).toContain("<UseFilter>yes</UseFilter>");
        });

        it("builds delete warehouse request with Id and Action only", () => {
            // Arrange
            const request = {
                warehouses: [{ id: 4590231, action: "delete" as const }],
            };

            // Act
            const xml = endpoint.buildRequest(request);

            // Assert
            expect(xml).toContain("<Id>4590231</Id>");
            expect(xml).toContain("<Action>delete</Action>");
            expect(xml).not.toContain("<Name>");
        });
    });

    describe("parseResponse", () => {
        it("parses successful setWarehouse response", () => {
            // Arrange
            const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>4590231</Id>
        <Status>ok</Status>
    </Warehouse>
</Warehouses>`;

            // Act
            const result = endpoint.parseResponse(xml);

            // Assert
            expect(result).toEqual([{ id: "4590231", status: "ok", error: undefined, action: undefined }]);
        });

        it("parses error setWarehouse response", () => {
            // Arrange
            const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<Warehouses>
    <Warehouse>
        <Id>4590231</Id>
        <Status>error</Status>
        <Error>Warehouse not found</Error>
    </Warehouse>
</Warehouses>`;

            // Act
            const result = endpoint.parseResponse(xml);

            // Assert
            expect(result).toEqual([{ id: "4590231", status: "error", error: "Warehouse not found", action: undefined }]);
        });
    });
});
