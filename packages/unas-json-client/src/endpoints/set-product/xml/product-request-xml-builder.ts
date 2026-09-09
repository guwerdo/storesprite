import type {
    ISetProduct,
    ISetProductCategory,
    ISetProductData,
    ISetProductImage,
    ISetProductImages,
    ISetProductPrices,
    ISetProductStock,
} from "../set-product.types.js";
import type {
    ICategoryElement,
    IDataElement,
    IDescriptionElement,
    IImageElement,
    IImagesElement,
    IPricesElement,
    IProductElement,
    IStockElement,
} from "./product-request-xml-elements.interface.js";

export function createProductElement(product: ISetProduct): IProductElement {
    return {
        Sku: product.sku,
        Action: product.action ?? "modify",
        Name: product.name !== undefined ? { "#cdata": product.name } : undefined,
        Description: product.description !== undefined ? createDescriptionElement(product.description) : undefined,
        Categories: product.categories && product.categories.length > 0 ? { Category: createCategoryElements(product.categories) } : undefined,
        Prices: product.prices ? createPricesElement(product.prices) : undefined,
        Stocks: product.stocks && product.stocks.length > 0 ? { Status: { Active: 1 }, Stock: createStockElements(product.stocks) } : undefined,
        Images: product.images ? createImagesElement(product.images) : undefined,
        Datas: product.datas && product.datas.length > 0 ? { Data: createDataElements(product.datas) } : undefined,
    };
}

export function createDescriptionElement(description: string): IDescriptionElement {
    return { Long: { "#cdata": description } };
}

export function createCategoryElements(categories: ISetProductCategory[]): ICategoryElement[] {
    return categories.map((cat) => ({
        Type: cat.type ?? "base",
        Id: cat.id,
    }));
}

export function createPricesElement(prices: ISetProductPrices): IPricesElement {
    const priceElements = prices.prices?.map((p) => ({
        Type: p.type ?? "normal",
        Net: p.net,
        Gross: p.gross,
        Actual: p.actual ?? 1,
    }));

    return {
        Vat: prices.vat,
        Price: priceElements && priceElements.length > 0 ? priceElements : undefined,
    };
}

export function createStockElements(stocks: ISetProductStock[]): IStockElement[] {
    return stocks.map((stock) => {
        if (stock.quantity === undefined || stock.quantity === null) {
            throw new Error("ISetProductStock is missing quantity");
        }
        // WarehouseId 1 (or "1") is the default main warehouse in UNAS — omitted from XML
        const warehouseId = stock.warehouseId === undefined || stock.warehouseId === 1 || String(stock.warehouseId).trim() === "1"
            ? undefined
            : stock.warehouseId;
        const isActive = stock.isActive === false || stock.isActive === "no" ? "no" : "yes";
        return { WarehouseId: warehouseId, IsActive: isActive, Qty: Number(stock.quantity) };
    });
}

export function createDataElements(datas: ISetProductData[]): IDataElement[] {
    return datas.map((data) => {
        if (data.value === undefined || data.value === null || !data.id) {
            throw new Error("ISetProductData is missing value or id");
        }
        return { Id: data.id, Value: { "#cdata": data.value } };
    });
}

export function createImagesElement(images: ISetProductImages): IImagesElement {
    return {
        DefaultFilename: { "#cdata": images.defaultFilename },
        DefaultAlt: { "#cdata": images.defaultAlt },
        OG: images.og,
        Version: images.version,
        Image: images.images.map((image) => createImageElement(image)),
    };
}

export function createImageElement(image: ISetProductImage): IImageElement {
    return {
        Type: image.type,
        Id: image.id,
        SefUrl: { "#cdata": image.sefUrl },
        Filename: { "#cdata": image.filename },
        Alt: { "#cdata": image.alt },
        Import: { Url: image.importUrl },
    };
}
