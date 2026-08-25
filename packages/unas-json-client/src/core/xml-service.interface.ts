export interface IXmlService {
    /** Parse an XML string into a plain object (repeating tags become arrays). */
    parse<T>(xml: string): T;
    /** Build an XML document (with the `<?xml …?>` prolog) from a plain object. */
    buildDocument(root: unknown): string;
}
