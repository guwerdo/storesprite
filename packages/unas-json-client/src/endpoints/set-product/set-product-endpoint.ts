import { inject, injectable } from "inversify";
import type { IUnasEndpoint } from "../../core/unas-endpoint.interface.js";
import type { IXmlService } from "../../core/xml-service.interface.js";
import { TYPES } from "../../types/binding-keys.js";
import type { ISetProductRequest, ISetProductResponse } from "./set-product.types.js";
import { createProductElement } from "./xml/product-request-xml-builder.js";

interface ISetProductResponseContent {
    Products?: { Product?: { Id: number | string; Sku: string; Action: string; Status: string }[] };
}

@injectable()
export class SetProductEndpoint implements IUnasEndpoint<ISetProductRequest, ISetProductResponse[]> {
    public readonly name = "setProduct";
    public readonly requiresAuth = true;

    constructor(@inject(TYPES.IXmlService) private readonly _xml: IXmlService) {}

    public buildRequest(request: ISetProductRequest): string {
        const productElements = request.products.map(createProductElement);
        return this._xml.buildDocument({ Products: { Product: productElements } });
    }

    public parseResponse(xml: string): ISetProductResponse[] {
        const parsed = this._xml.parse<ISetProductResponseContent>(xml);
        const products = parsed.Products?.Product;
        if (!products) {
            return [];
        }
        return products.map((p) => ({
            id: String(p.Id),
            sku: p.Sku,
            action: p.Action,
            status: p.Status === "error" ? "error" : "ok",
        }));
    }
}
