export interface IUnasJsonClientConfig {
    /** Base URL of the UNAS shop API, e.g. "https://api.unas.eu/shop/" (trailing slash). */
    baseUrl: string;
    apiKey: string;
    /**
     * Key under which this client's auth token is stored in the injected token
     * store. Set this to a per-tenant identifier (e.g. a userId) whenever the
     * token store is shared across requests, so tokens never collide between
     * tenants. Defaults to "unasToken" when omitted.
     */
    tokenKey?: string;
}
