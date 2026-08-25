import { inject, injectable } from "inversify";
import type { IUnasEndpoint } from "../../core/unas-endpoint.interface.js";
import type { IXmlService } from "../../core/xml-service.interface.js";
import { TYPES } from "../../types/binding-keys.js";
import { UnasParseError } from "../../types/errors.js";
import type { IGetProductDBRequest } from "./get-product-db.types.js";

interface IGetProductDbContent {
    getProductDB?: { Url?: string };
}

@injectable()
export class GetProductDbEndpoint implements IUnasEndpoint<IGetProductDBRequest, string> {
    public readonly name = "getProductDB";
    public readonly requiresAuth = true;

    constructor(@inject(TYPES.IXmlService) private readonly _xml: IXmlService) {}

    public buildRequest(request: IGetProductDBRequest): string {
        return this._xml.buildDocument({
            Params: {
                Format: request.format ?? "csv",
                GetParam: request.getParam === false ? "0" : "1",
                GetStock: request.getStock === false ? "0" : "1",
                GetData: request.getData === false ? "0" : "1",
            },
        });
    }

    public parseResponse(xml: string): string {
        const parsed = this._xml.parse<IGetProductDbContent>(xml);
        const url = parsed.getProductDB?.Url;
        if (!url) {
            throw new UnasParseError("getProductDB response missing <getProductDB><Url>");
        }
        return url;
    }
}
