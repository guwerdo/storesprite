import { mock } from "jest-mock-extended";
import { Logger } from "log4js";

import { IAxiosHttpClient } from "../../http-client/index.js";
import { IRepository } from "../../repository/index.js";
import { IUnasClient } from "../client/index.js";
import { ProductDto, comparePlainProductDto } from "../dto/index.js";
import { UnasUpdater } from "./index.js";

// run all tests: `npm test`
// run this test:
// - `npx jest -t "should call unasClient.sendUpdate"`
// - mark the test as `only`: `it.only("should call unasClient.sendUpdate", async () => {`

describe("UnasUpdater with jest-mock-extended", () => {
    it("should call unasClient.createDataElements", () => {
        // Arrange
        const unasClient = mock<IUnasClient>();
        const logger = mock<Logger>();
        const httpClient = mock<IAxiosHttpClient>();
        const unasCacheRepo = mock<IRepository<ProductDto>>();
        const validatedUrlsRepo = mock<IRepository<string>>();
        const updater = new UnasUpdater(logger, httpClient, unasClient, unasCacheRepo, validatedUrlsRepo);

        const product: ProductDto = { sku: "ABC123", description: "Sample", stocks: [], images: [], datas: [], stockSpriteParam: undefined };
        const mergedProductDto = { sku: "ABC123", description: "Sample", stocks: [], images: [], datas: [], stockSpriteParam: undefined };
        const differences = comparePlainProductDto(mergedProductDto, product);

        // Act
        const dataElements = updater.createDataElements(product, differences);

        // Assert
        expect(dataElements).toHaveLength(1);
    });
});
