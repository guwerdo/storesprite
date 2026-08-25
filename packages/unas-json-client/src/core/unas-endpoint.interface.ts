/**
 * The extension contract: one class per UNAS operation.
 *
 * An endpoint owns all of its XML knowledge; the client is generic and never
 * knows about a specific endpoint's request/response shape.
 */
export interface IUnasEndpoint<TRequest = unknown, TResponse = unknown> {
    /** Path suffix, e.g. "getProductDB" → `${baseUrl}getProductDB`. */
    readonly name: string;
    /** False only for `login` (which carries no Authorization header). */
    readonly requiresAuth: boolean;
    /** Typed JSON → full XML request body (undefined = no body). */
    buildRequest(request: TRequest): string | undefined;
    /** XML response body → typed JSON. */
    parseResponse(xml: string): TResponse;
}
