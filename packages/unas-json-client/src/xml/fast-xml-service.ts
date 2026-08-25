import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { injectable } from "inversify";
import type { IXmlService } from "../core/xml-service.interface.js";

@injectable()
export class FastXmlService implements IXmlService {
    private readonly _parser: XMLParser;

    constructor() {
        this._parser = new XMLParser({
            ignoreAttributes: false,
            // Repeating elements that must always parse as arrays (even when single).
            // Add to this list as new endpoints are introduced (Order, Customer, …).
            isArray: (tagName: string) => tagName === "Product" || tagName === "Warehouse",
        });
    }

    public parse<T>(xml: string): T {
        return this._parser.parse(xml) as T;
    }

    public buildDocument(root: unknown): string {
        // `format: false` keeps the output minified — UNAS rejects newlines inside <Filename> CDATA.
        const builder = new XMLBuilder({ ignoreAttributes: false, format: false, indentBy: "", cdataPropName: "#cdata" });
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build(root);
    }
}
