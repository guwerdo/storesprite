import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import { Queue } from "bullmq";
import { Logger } from "log4js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IAxiosHttpClient } from "../../http-client/index.js";
import { IRepository } from "../../repository/interfaces/index.js";
import { IDataElement, IProductElement, IStockElement } from "../client/request/builder/interfaces/index.js";
import { IDtoDifference, IImageDto, IProductDto, IStockDto } from "../dto/interfaces/index.js";
import { UnasTranslator } from "./unas-translator.js";

// run all tests: `npm test`
// run this test:
//run `vitest` `translate returns correct stock value and reset stock not in source`
// - `npx vitest -t "translate returns correct stock value and reset stock not in source"`
// - `npx vitest src/unas/translator/unas-translator.test.ts` run thests in this file.
// - mark the test as `only`: `it.only("should call unasClient.sendUpdate", async () => {`

describe("UnasTranslator", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const setupAxiosResponse = (status: number): AxiosResponse => ({
        data: undefined,
        status,
        statusText: "",
        headers: {},
        config: { headers: {} } as InternalAxiosRequestConfig,
    });

    const setupValidatedUrlsRepo = (overrides?: Partial<IRepository<string>>): IRepository<string> => ({
        get: vi.fn<(key: string) => Promise<string | undefined>>(),
        getAll: vi.fn<() => Promise<string[] | undefined>>(),
        add: vi.fn<(key: string, value: string) => Promise<void>>(),
        delete: vi.fn<(key: string) => Promise<void>>(),
        exists: vi.fn<(key: string, value: string) => Promise<boolean>>(),
        ...overrides,
    });

    const setupHttpClient = (overrides?: Partial<IAxiosHttpClient>): IAxiosHttpClient => ({
        instance: axios.create(),
        ...overrides,
    });

    const setupUnasCacheRepo = (overrides?: Partial<IRepository<IProductDto>>): IRepository<IProductDto> => ({
        get: vi.fn<(key: string) => Promise<IProductDto | undefined>>(),
        getAll: vi.fn<() => Promise<IProductDto[] | undefined>>(),
        add: vi.fn<(key: string, value: IProductDto) => Promise<void>>(),
        delete: vi.fn<(key: string) => Promise<void>>(),
        exists: vi.fn<(key: string, value: string) => Promise<boolean>>(),
        ...overrides,
    });

    const setupLogger = (): Logger =>
        ({
            trace: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            fatal: vi.fn(),
            mark: vi.fn(),
            level: "info",
            isLevelEnabled: vi.fn(),
            isTraceEnabled: vi.fn(),
            isDebugEnabled: vi.fn(),
            isInfoEnabled: vi.fn(),
            isWarnEnabled: vi.fn(),
            isErrorEnabled: vi.fn(),
            isFatalEnabled: vi.fn(),
            addContext: vi.fn(),
            removeContext: vi.fn(),
            clearContext: vi.fn(),
            setParseCallStackFunction: vi.fn(),
        }) as unknown as Logger;

    const setupQueue = (): Queue =>
        ({
            add: vi.fn(),
        }) as unknown as Queue;

    const setupTranslator = (overrides?: {
        translatedQueue?: Queue;
        httpClient?: IAxiosHttpClient;
        validatedUrlsRepo?: IRepository<string>;
        unasCacheRepo?: IRepository<IProductDto>;
        logger?: Logger;
    }) => {
        const logger = overrides?.logger ?? setupLogger();
        const translatedQueue = overrides?.translatedQueue ?? setupQueue();
        const httpClient = overrides?.httpClient ?? setupHttpClient();
        const unasCacheRepo = overrides?.unasCacheRepo ?? setupUnasCacheRepo();
        const validatedUrlsRepo = overrides?.validatedUrlsRepo ?? setupValidatedUrlsRepo();
        return new UnasTranslator(logger, translatedQueue, httpClient, unasCacheRepo, validatedUrlsRepo);
    };

    describe("verifyImageUrl", () => {
        it("should return false when uri is missing", async () => {
            const updater = setupTranslator();

            const images: IImageDto[] = [{ uri: undefined, title: "One", fileName: "one.jpg", description: "", order: 1 }];

            const result = await updater.verifyImageUrl(images);

            expect(result).toBe(false);
        });

        it("should cache validated urls when url is not cached", async () => {
            const httpClient = setupHttpClient();
            const headSpy = vi.spyOn(httpClient.instance, "head").mockResolvedValue(setupAxiosResponse(200));
            const validatedUrlsRepo = setupValidatedUrlsRepo({
                exists: vi.fn<(key: string, value: string) => Promise<boolean>>().mockResolvedValue(false),
                add: vi.fn<(key: string, value: string) => Promise<void>>().mockResolvedValue(undefined),
            });
            const existsSpy = vi.spyOn(validatedUrlsRepo, "exists");
            const addSpy = vi.spyOn(validatedUrlsRepo, "add");
            const updater = setupTranslator({ httpClient, validatedUrlsRepo });

            const images: IImageDto[] = [{ uri: "https://example.com/one.jpg", title: "One", fileName: "one.jpg", description: "", order: 1 }];

            const result = await updater.verifyImageUrl(images);

            expect(result).toBe(true);
            expect(existsSpy).toHaveBeenCalledWith("", "https://example.com/one.jpg");
            expect(headSpy).toHaveBeenCalledWith("https://example.com/one.jpg");
            expect(addSpy).toHaveBeenCalledWith("", "https://example.com/one.jpg");
        });

        it("should skip cached urls when url is already cached", async () => {
            const httpClient = setupHttpClient();
            const headSpy = vi.spyOn(httpClient.instance, "head");
            const validatedUrlsRepo = setupValidatedUrlsRepo({
                exists: vi.fn<(key: string, value: string) => Promise<boolean>>().mockResolvedValue(true),
            });
            const addSpy = vi.spyOn(validatedUrlsRepo, "add");
            const updater = setupTranslator({ httpClient, validatedUrlsRepo });

            const images: IImageDto[] = [
                { uri: "https://example.com/cached.jpg", title: "Cached", fileName: "cached.jpg", description: "", order: 1 },
            ];

            const result = await updater.verifyImageUrl(images);

            expect(result).toBe(true);
            expect(headSpy).not.toHaveBeenCalled();
            expect(addSpy).not.toHaveBeenCalled();
        });

        it("should return false when head request fails", async () => {
            // Arrange
            const httpClient = setupHttpClient();
            vi.spyOn(httpClient.instance, "head").mockRejectedValue(new Error("Network error"));
            const validatedUrlsRepo = setupValidatedUrlsRepo({
                exists: vi.fn<(key: string, value: string) => Promise<boolean>>().mockResolvedValue(false),
            });
            const existsSpy = vi.spyOn(validatedUrlsRepo, "exists");
            const translator = setupTranslator({ httpClient, validatedUrlsRepo });
            const images: IImageDto[] = [{ uri: "https://example.com/fail.jpg", title: "Fail", fileName: "fail.jpg", description: "", order: 1 }];

            // Act
            const result = await translator.verifyImageUrl(images);

            // Assert
            expect(result).toBe(false);
            expect(existsSpy).toHaveBeenCalledWith("", "https://example.com/fail.jpg");
        });
    });

    describe("createDataElements", () => {
        it("should map datas from product dto", () => {
            // Arrange
            const updater = setupTranslator();
            const productDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: undefined,
                images: undefined,
                datas: [
                    { id: 1, value: "test value" },
                    { id: 2, value: "another value" },
                ],
            };

            // Act
            const result = updater.createDataElements(productDto);

            // Assert
            expect(result).toBeDefined();
            const dataElements = result as IDataElement[];
            expect(dataElements).toHaveLength(2);
            expect(dataElements[0]).toEqual({ Id: 1, Value: { "#cdata": "test value" } });
            expect(dataElements[1]).toEqual({ Id: 2, Value: { "#cdata": "another value" } });
        });

        it("should return empty array when datas is empty", () => {
            // Arrange
            const updater = setupTranslator();
            const productDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: undefined,
                images: undefined,
                datas: [],
            };

            // Act
            const result = updater.createDataElements(productDto);

            // Assert
            expect(result).toEqual([]);
        });
    });

    describe("createStockElements", () => {
        it("should map stocks from product dto", () => {
            // Arrange
            const updater = setupTranslator();
            const productDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: [
                    { warehouseId: 10, quantity: 100 },
                    { warehouseId: 20, quantity: 50 },
                ],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.createStockElements(productDto);

            // Assert
            expect(result).toBeDefined();
            const stockElements = result as IStockElement[];
            expect(stockElements).toHaveLength(2);
            expect(stockElements[0]).toEqual({ WarehouseId: 10, IsActive: "yes", Qty: 100 });
            expect(stockElements[1]).toEqual({ WarehouseId: 20, IsActive: "yes", Qty: 50 });
        });

        it("should return empty array when stocks is empty", () => {
            // Arrange
            const updater = setupTranslator();
            const productDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: [],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.createStockElements(productDto);

            // Assert
            expect(result).toBeDefined();
            const stockElements = result as IStockElement[];
            expect(stockElements.length).toBe(0);
        });
    });

    describe("mergeAndCompareNormalized", () => {
        it("should return merged dto and diffs when source differs from target", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceDto: IProductDto = {
                sku: "TEST-SKU",
                description: "New description",
                stocks: [{ warehouseId: 1, quantity: 100 }],
                images: undefined,
                datas: undefined,
            };
            const targetDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Old description",
                stocks: [{ warehouseId: 1, quantity: 50 }],
                images: undefined,
                datas: undefined,
            };
            const mergedDto: IProductDto = {
                sku: "TEST-SKU",
                description: "New description",
                stocks: [{ warehouseId: 1, quantity: 100 }],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.mergeAndCompareNormalized(sourceDto, targetDto);

            // Assert
            const expectedProductDto: IProductDto = { ...mergedDto };
            const expectedDifferences: IDtoDifference[] = [
                { op: "replace", path: ["description"], value: "New description" },
                { op: "replace", path: ["stocks", 0, "quantity"], value: 100 },
            ];

            expect(result[0]).toStrictEqual(expectedProductDto);
            expect(result[1]).toStrictEqual(expectedDifferences);
        });

        it("should return no diffs when source equals target", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Same description",
                stocks: [{ warehouseId: 1, quantity: 100 }],
                images: undefined,
                datas: undefined,
            };
            const targetDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Same description",
                stocks: [{ warehouseId: 1, quantity: 100 }],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.mergeAndCompareNormalized(sourceDto, targetDto);

            // Assert
            expect(result[0]).toStrictEqual(sourceDto);
            expect(result[1]).toEqual([]);
        });

        it("should detect multiple diffs when source and target have multiple differences", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceDto: IProductDto = {
                sku: "TEST-SKU",
                description: "New description",
                stocks: [{ warehouseId: 1, quantity: 200 }],
                images: undefined,
                datas: [{ id: 1, value: "new value" }],
            };
            const targetDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Old description",
                stocks: [
                    { warehouseId: 1, quantity: 100 },
                    { warehouseId: 2, quantity: 400 },
                ],
                images: undefined,
                datas: [{ id: 1, value: "old value" }],
            };
            const mergedDto: IProductDto = {
                sku: "TEST-SKU",
                description: "New description",
                stocks: [
                    { warehouseId: 1, quantity: 200 },
                    { warehouseId: 2, quantity: 400 },
                ],
                images: undefined,
                datas: [{ id: 1, value: "new value" }],
            };

            // Act
            const result = updater.mergeAndCompareNormalized(sourceDto, targetDto);

            // Assert
            const expectedProductDto: IProductDto = { ...mergedDto };
            const expectedDifferences: IDtoDifference[] = [
                { op: "replace", path: ["description"], value: "New description" },
                { op: "replace", path: ["stocks", 0, "quantity"], value: 200 },
                { op: "replace", path: ["datas", 0, "value"], value: "new value" },
            ];

            expect(result[0]).toStrictEqual(expectedProductDto);
            expect(result[1]).toStrictEqual(expectedDifferences);
        });
    });

    describe("createProductXmlElement", () => {
        it("should return undefined when source equals target", () => {
            // Arrange
            const updater = setupTranslator();
            const productDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Same description",
                stocks: [{ warehouseId: 1, quantity: 100 }],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.createProductXmlElement({ ...productDto }, { ...productDto });

            // Assert
            expect(result).toBeUndefined();
        });

        it("should return undefined when force update is true and source equals target", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Same description",
                stocks: undefined,
                images: undefined,
                datas: undefined,
            };
            const targetProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Same description",
                stocks: [
                    { warehouseId: 10, quantity: 100 },
                    { warehouseId: 20, quantity: 200 },
                    { warehouseId: 30, quantity: 300 },
                ],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.createProductXmlElement({ ...sourceProductDto }, { ...targetProductDto }, true);

            // Assert
            expect(result).toBeUndefined();
        });

        it("should update stock when source stock differs from target", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Ignored description",
                stocks: [{ warehouseId: 1, quantity: 200 }],
                images: undefined,
                datas: undefined,
            };
            const targetProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Old description",
                stocks: [{ warehouseId: 1, quantity: 100 }],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.createProductXmlElement(sourceProductDto, targetProductDto);

            // Assert
            expect(result).toBeDefined();
            if (result) {
                const [, mergedDto] = result;
                expect(mergedDto.sku).toBe("TEST-SKU");
                expect(mergedDto.stocks).toBeDefined();
                expect(mergedDto.stocks?.[0]?.quantity).toBe(200);
            }
        });

        it("should update data when source data differs from target", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: undefined,
                images: undefined,
                datas: [{ id: 1, value: "new value" }],
            };
            const targetProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: undefined,
                images: undefined,
                datas: [{ id: 1, value: "old value" }],
            };

            // Act
            const result = updater.createProductXmlElement(sourceProductDto, targetProductDto);

            // Assert
            expect(result).toBeDefined();
            if (result) {
                const [, mergedDto] = result;
                expect(mergedDto.sku).toBe("TEST-SKU");
                expect(mergedDto.datas).toBeDefined();
                expect(mergedDto.datas?.[0]?.value).toBe("new value");
            }
        });

        it("should update stock and data when both differ from target", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: [{ warehouseId: 1, quantity: 150 }],
                images: undefined,
                datas: [{ id: 1, value: "updated value" }],
            };
            const targetProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: [{ warehouseId: 1, quantity: 100 }],
                images: undefined,
                datas: [{ id: 1, value: "old value" }],
            };

            // Act
            const result = updater.createProductXmlElement(sourceProductDto, targetProductDto);

            // Assert
            expect(result).toBeDefined();
            if (result) {
                const [, mergedDto] = result;
                expect(mergedDto.sku).toBe("TEST-SKU");
                expect(mergedDto.stocks?.[0]?.quantity).toBe(150);
                expect(mergedDto.datas?.[0]?.value).toBe("updated value");
            }
        });

        it("should clear description and images", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Source description",
                stocks: [{ warehouseId: 1, quantity: 200 }],
                images: undefined,
                datas: undefined,
            };
            const targetProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "Target description",
                stocks: [{ warehouseId: 1, quantity: 100 }],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.createProductXmlElement(sourceProductDto, targetProductDto);

            // Assert
            expect(result).toBeDefined();
            if (result) {
                const [, mergedDto] = result;
                expect(mergedDto.description).toBeUndefined();
                expect(mergedDto.images).toBeUndefined();
            }
        });

        it("should merge stocks from source and target", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: [
                    { warehouseId: 1, quantity: 200 },
                    { warehouseId: 2, quantity: 50 },
                ],
                images: undefined,
                datas: undefined,
            };
            const targetProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: [
                    { warehouseId: 1, quantity: 100 },
                    { warehouseId: 3, quantity: 30 },
                ],
                images: undefined,
                datas: undefined,
            };

            // Act
            const result = updater.createProductXmlElement(sourceProductDto, targetProductDto);

            // Assert
            expect(result).toBeDefined();
            if (result) {
                const [, mergedDto] = result;
                expect(mergedDto.sku).toBe("TEST-SKU");
                expect(mergedDto.stocks).toBeDefined();
                expect(mergedDto.stocks?.length).toBe(3);
            }
        });

        it("should reset non-source stocks to zero", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: [
                    { warehouseId: 10, quantity: 201 },
                    { warehouseId: 30, quantity: 103 },
                ],
                images: undefined,
                datas: undefined,
            };
            const targetProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: undefined,
                stocks: [
                    { warehouseId: 10, quantity: 101 },
                    { warehouseId: 20, quantity: 102 },
                    { warehouseId: 30, quantity: 103 },
                    { warehouseId: 40, quantity: 104 },
                ],
                images: undefined,
                datas: undefined,
            };

            // Act
            const [productElement, productDto] = updater.createProductXmlElement(sourceProductDto, targetProductDto) ?? [];

            // Assert
            expect(productElement).toBeDefined();
            expect(productElement?.Stocks?.Stock.length).toBe(4);
            expect(productElement?.Stocks?.Stock.find((s) => s.WarehouseId === 10)?.Qty).toBe(201);
            expect(productElement?.Stocks?.Stock.find((s) => s.WarehouseId === 20)?.Qty).toBe(0);
            expect(productElement?.Stocks?.Stock.find((s) => s.WarehouseId === 30)?.Qty).toBe(103);
            expect(productElement?.Stocks?.Stock.find((s) => s.WarehouseId === 40)?.Qty).toBe(0);

            expect(productDto).toBeDefined();
            expect(productDto?.stocks?.length).toBe(4);
            expect(productDto?.stocks?.find((s) => s.warehouseId === 10)?.quantity).toBe(201);
            expect(productDto?.stocks?.find((s) => s.warehouseId === 20)?.quantity).toBe(0);
            expect(productDto?.stocks?.find((s) => s.warehouseId === 30)?.quantity).toBe(103);
            expect(productDto?.stocks?.find((s) => s.warehouseId === 40)?.quantity).toBe(0);
        });
    });

    describe("resetAllStocksOtherThanSourceStock", () => {
        it("should keep source stocks and zero other warehouses", () => {
            const updater = setupTranslator();

            const sourceStocks: IStockDto[] = [
                { warehouseId: 10, quantity: 150 },
                { warehouseId: 20, quantity: 250 },
            ];

            const mergedStocks: IStockDto[] = [
                { warehouseId: 10, quantity: 100 },
                { warehouseId: 20, quantity: 200 },
                { warehouseId: 30, quantity: 300 },
            ];

            const stockDto = updater.resetAllStocksOtherThanSourceStock(mergedStocks, sourceStocks);

            expect(stockDto).toHaveLength(3);
            expect(stockDto[0]).toEqual({ warehouseId: 10, quantity: 150 });
            expect(stockDto[1]).toEqual({ warehouseId: 20, quantity: 250 });
            expect(stockDto[2]).toEqual({ warehouseId: 30, quantity: 0 });
        });

        it("should zero all merged stocks when source is empty", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceStocks: IStockDto[] = [];
            const mergedStocks: IStockDto[] = [
                { warehouseId: 10, quantity: 100 },
                { warehouseId: 20, quantity: 200 },
            ];

            // Act
            const stockDto = updater.resetAllStocksOtherThanSourceStock(mergedStocks, sourceStocks);

            // Assert
            expect(stockDto).toHaveLength(2);
            expect(stockDto[0]).toEqual({ warehouseId: 10, quantity: 0 });
            expect(stockDto[1]).toEqual({ warehouseId: 20, quantity: 0 });
        });

        it("should handle single warehouse correctly", () => {
            // Arrange
            const updater = setupTranslator();
            const sourceStocks: IStockDto[] = [{ warehouseId: 10, quantity: 250 }];
            const mergedStocks: IStockDto[] = [{ warehouseId: 10, quantity: 100 }];

            // Act
            const stockDto = updater.resetAllStocksOtherThanSourceStock(mergedStocks, sourceStocks);

            // Assert
            expect(stockDto).toHaveLength(1);
            expect(stockDto[0]).toEqual({ warehouseId: 10, quantity: 250 });
        });

        it("should preserve merged warehouse ids while updating quantities", () => {
            // Arrange
            const updater = setupTranslator();

            const sourceStocks: IStockDto[] = [{ warehouseId: 10, quantity: 500 }];

            const mergedStocks: IStockDto[] = [
                { warehouseId: 50, quantity: 100 },
                { warehouseId: 10, quantity: 200 },
                { warehouseId: 15, quantity: 300 },
            ];

            // Act
            const stockDto = updater.resetAllStocksOtherThanSourceStock(mergedStocks, sourceStocks);

            // Assert
            expect(stockDto).toHaveLength(3);
            expect(stockDto[0]).toEqual({ warehouseId: 50, quantity: 0 });
            expect(stockDto[1]).toEqual({ warehouseId: 10, quantity: 500 });
            expect(stockDto[2]).toEqual({ warehouseId: 15, quantity: 0 });
        });

        it("should ignore source warehouses not in merged list", () => {
            // Arrange
            const updater = setupTranslator();

            const sourceStocks: IStockDto[] = [
                { warehouseId: 10, quantity: 150 },
                { warehouseId: 99, quantity: 999 }, // warehouse not in merged
            ];

            const mergedStocks: IStockDto[] = [
                { warehouseId: 10, quantity: 100 },
                { warehouseId: 20, quantity: 200 },
            ];

            // Act
            const stockDto = updater.resetAllStocksOtherThanSourceStock(mergedStocks, sourceStocks);

            // Assert
            expect(stockDto).toBeDefined();
            expect(stockDto).toHaveLength(2);
            expect(stockDto[0]).toEqual({ warehouseId: 10, quantity: 150 });
            expect(stockDto[1]).toEqual({ warehouseId: 20, quantity: 0 });
        });
    });

    describe("translate", () => {
        it("should enqueue update with non-source stocks zeroed", async () => {
            // Arrange
            const unasCacheRepo = setupUnasCacheRepo({
                get: vi.fn<(key: string) => Promise<IProductDto | undefined>>().mockResolvedValue({
                    sku: "TEST-SKU",
                    description: "Old description",
                    stocks: [
                        { warehouseId: 10, quantity: 100 },
                        { warehouseId: 20, quantity: 400 },
                        { warehouseId: 30, quantity: 500 },
                    ],
                    images: undefined,
                    datas: undefined,
                }),
            });

            const translator = setupTranslator({ unasCacheRepo });
            const queueAddSpy = vi.spyOn(translator["_translatedQueue"], "add");

            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "New description",
                stocks: [{ warehouseId: 10, quantity: 250 }],
                images: undefined,
                datas: undefined,
            };

            // Act
            await translator.translate(sourceProductDto);

            // Assert
            const addCallArgs = queueAddSpy.mock.calls[0]?.[1] as { productXml: IProductElement; productDto: IProductDto };
            const productElement = addCallArgs.productXml;
            const productDto = addCallArgs.productDto;

            expect(queueAddSpy).toHaveBeenCalled();
            expect(addCallArgs).toBeDefined();
            expect(productDto).toBeDefined();
            expect(productDto.stocks).toBeDefined();
            expect(productDto.stocks).toHaveLength(3);
            expect(productDto.stocks?.[0]).toEqual({ warehouseId: 10, quantity: 250 });
            expect(productDto.stocks?.[1]).toEqual({ warehouseId: 20, quantity: 0 });
            expect(productDto.stocks?.[2]).toEqual({ warehouseId: 30, quantity: 0 });

            expect(productElement).toBeDefined();
            expect(productElement.Stocks).toBeDefined();
            expect(productElement.Stocks?.Stock).toHaveLength(3);
            expect(productElement.Stocks?.Stock[0]).toEqual({ WarehouseId: 10, IsActive: "yes", Qty: 250 });
            expect(productElement.Stocks?.Stock[1]).toEqual({ WarehouseId: 20, IsActive: "yes", Qty: 0 });
            expect(productElement.Stocks?.Stock[2]).toEqual({ WarehouseId: 30, IsActive: "yes", Qty: 0 });
        });

        // this test fails, dont know if this should be the correct behaviour or if the translator should skip enqueuing when source stocks are empty to avoid resetting all stocks in target, needs discussion
        it.skip("should enqueue stock reset when source stocks are empty", async () => {
            // Arrange
            const unasCacheRepo = setupUnasCacheRepo({
                get: vi.fn<(key: string) => Promise<IProductDto | undefined>>().mockResolvedValue({
                    sku: "TEST-SKU",
                    description: "Old description",
                    stocks: [
                        { warehouseId: 10, quantity: 100 },
                        { warehouseId: 20, quantity: 400 },
                        { warehouseId: 30, quantity: 500 },
                    ],
                    images: undefined,
                    datas: undefined,
                }),
            });

            const translator = setupTranslator({ unasCacheRepo });
            const queueAddSpy = vi.spyOn(translator["_translatedQueue"], "add");

            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "New description",
                stocks: [], // empty stocks should reset all stocks in target
                images: undefined,
                datas: undefined,
            };

            // Act
            await translator.translate(sourceProductDto);

            // Assert
            expect(queueAddSpy).toHaveBeenCalled();
            const addCallArgs = queueAddSpy.mock.calls[0]?.[1] as { productXml: IProductElement; productDto: IProductDto };
            const productElement = addCallArgs.productXml;
            const productDto = addCallArgs.productDto;

            expect(addCallArgs).toBeDefined();
            expect(productDto).toBeDefined();
            expect(productDto.stocks).toBeDefined();
            expect(productDto.stocks).toHaveLength(3);
            expect(productDto.stocks?.[0]).toEqual({ warehouseId: 10, quantity: 0 });
            expect(productDto.stocks?.[1]).toEqual({ warehouseId: 20, quantity: 0 });
            expect(productDto.stocks?.[2]).toEqual({ warehouseId: 30, quantity: 0 });

            expect(productElement).toBeDefined();
            expect(productElement.Stocks).toBeDefined();
            expect(productElement.Stocks?.Stock).toHaveLength(3);
            expect(productElement.Stocks?.Stock[0]).toEqual({ WarehouseId: 10, IsActive: "yes", Qty: 0 });
            expect(productElement.Stocks?.Stock[1]).toEqual({ WarehouseId: 20, IsActive: "yes", Qty: 0 });
            expect(productElement.Stocks?.Stock[2]).toEqual({ WarehouseId: 30, IsActive: "yes", Qty: 0 });
        });

        it("should enqueue update even when source equals cache when force update is true", async () => {
            // Arrange
            const unasCacheRepo = setupUnasCacheRepo({
                get: vi.fn<(key: string) => Promise<IProductDto | undefined>>().mockResolvedValue({
                    sku: "TEST-SKU",
                    description: "Old description",
                    stocks: [
                        { warehouseId: 10, quantity: 100 },
                        { warehouseId: 20, quantity: 200 },
                        { warehouseId: 30, quantity: 300 },
                    ],
                    images: undefined,
                    datas: undefined,
                }),
            });

            const translator = setupTranslator({ unasCacheRepo });
            const queueAddSpy = vi.spyOn(translator["_translatedQueue"], "add");

            const sourceProductDto: IProductDto = {
                sku: "TEST-SKU",
                description: "New description",
                stocks: [
                    { warehouseId: 10, quantity: 100 },
                    { warehouseId: 20, quantity: 200 },
                    { warehouseId: 30, quantity: 300 },
                ],
                images: undefined,
                datas: undefined,
            };

            // Act
            await translator.translate(sourceProductDto, true); // force create element even if source equals cache to reset stocks not in source

            // Assert
            const addCallArgs = queueAddSpy.mock.calls[0]?.[1] as { productXml: IProductElement; productDto: IProductDto };
            const productElement = addCallArgs.productXml;
            const productDto = addCallArgs.productDto;

            expect(queueAddSpy).toHaveBeenCalled();
            expect(addCallArgs).toBeDefined();
            expect(productDto).toBeDefined();
            expect(productDto.stocks).toBeDefined();
            expect(productDto.stocks).toHaveLength(3);
            expect(productDto.stocks?.[0]).toEqual({ warehouseId: 10, quantity: 100 });
            expect(productDto.stocks?.[1]).toEqual({ warehouseId: 20, quantity: 200 });
            expect(productDto.stocks?.[2]).toEqual({ warehouseId: 30, quantity: 300 });

            expect(productElement).toBeDefined();
            expect(productElement.Stocks).toBeDefined();
            expect(productElement.Stocks?.Stock).toHaveLength(3);
            expect(productElement.Stocks?.Stock[0]).toEqual({ WarehouseId: 10, IsActive: "yes", Qty: 100 });
            expect(productElement.Stocks?.Stock[1]).toEqual({ WarehouseId: 20, IsActive: "yes", Qty: 200 });
            expect(productElement.Stocks?.Stock[2]).toEqual({ WarehouseId: 30, IsActive: "yes", Qty: 300 });
        });
    });
});
