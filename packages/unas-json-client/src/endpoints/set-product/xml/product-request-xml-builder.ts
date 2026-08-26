import type { ISetProduct, ISetProductData, ISetProductImage, ISetProductImages, ISetProductStock } from "../set-product.types.js";
import type { IDataElement, IDescriptionElement, IImageElement, IImagesElement, IProductElement, IStockElement } from "./product-request-xml-elements.interface.js";

// A single image cannot be updated via setProduct — only the whole set at once, keyed by <Version>.
export function createProductElement(product: ISetProduct): IProductElement {
    return {
        Sku: product.sku,
        Action: product.action ?? "modify",
        Description: product.description !== undefined ? createDescriptionElement(product.description) : undefined,
        Stocks: product.stocks && product.stocks.length > 0 ? { Status: { Active: 1 }, Stock: createStockElements(product.stocks) } : undefined,
        Images: product.images ? createImagesElement(product.images) : undefined,
        Datas: product.datas && product.datas.length > 0 ? { Data: createDataElements(product.datas) } : undefined,
    };
}

export function createDescriptionElement(description: string): IDescriptionElement {
    return { Long: { "#cdata": description } };
}

export function createStockElements(stocks: ISetProductStock[]): IStockElement[] {
    return stocks.map((stock) => {
        if (stock.quantity === undefined || stock.quantity === null) {
            throw new Error("ISetProductStock is missing quantity");
        }
        // WarehouseId 1 is the default (main) warehouse in UNAS — it is omitted from the XML.
        const warehouseId = stock.warehouseId === undefined || stock.warehouseId === 1 ? undefined : stock.warehouseId;
        return { WarehouseId: warehouseId, IsActive: stock.isActive === false ? "no" : "yes", Qty: stock.quantity };
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
