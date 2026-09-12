import { inject, injectable, multiInject } from "inversify";
import type { IUnasJsonClientConfig } from "../config/unas-json-client-config.interface.js";
import type { IUnasEndpoint } from "../core/unas-endpoint.interface.js";
import type { IUnasHttpClient, IUnasHttpResponse } from "../core/unas-http-client.interface.js";
import type { ILogger } from "../core/logger.interface.js";
import type { ITokenStore } from "../core/token-store.interface.js";
import type { IXmlService } from "../core/xml-service.interface.js";
import type { IGetProductDBRequest } from "../endpoints/get-product-db/get-product-db.types.js";
import type { IGetWarehouseRequest, IWarehouseResponse } from "../endpoints/get-warehouse/get-warehouse.types.js";
import type { ILoginRequest, ILoginResponse } from "../endpoints/login/login.types.js";
import type { ISetProductRequest, ISetProductResponse } from "../endpoints/set-product/set-product.types.js";
import type { ISetWarehouseRequest, ISetWarehouseResponse } from "../endpoints/set-warehouse/set-warehouse.types.js";
import { TYPES } from "../types/binding-keys.js";
import { UnasAuthError, UnasConfigError, UnasHttpError, UnasTransportError } from "../types/errors.js";
import type { IUnasJsonClient } from "./unas-json-client.interface.js";

const DEFAULT_TOKEN_KEY = "unasToken";

@injectable()
export class UnasJsonClient implements IUnasJsonClient {
    private readonly _endpoints: Map<string, IUnasEndpoint>;
    private readonly _baseUrl: string;
    private readonly _tokenKey: string;

    constructor(
        @inject(TYPES.IUnasJsonClientConfig) private readonly _config: IUnasJsonClientConfig,
        @inject(TYPES.IUnasHttpClient) private readonly _httpClient: IUnasHttpClient,
        @inject(TYPES.ITokenStore) private readonly _tokenStore: ITokenStore,
        @inject(TYPES.ILogger) private readonly _logger: ILogger,
        @inject(TYPES.IXmlService) private readonly _xmlService: IXmlService,
        @multiInject(TYPES.UnasEndpoint) endpoints: IUnasEndpoint[],
    ) {
        const rawBaseUrl = this._config.baseUrl ?? "https://api.unas.eu/shop/";
        this._baseUrl = rawBaseUrl.endsWith("/") ? rawBaseUrl : `${rawBaseUrl}/`;
        this._tokenKey = this._config.tokenKey ?? DEFAULT_TOKEN_KEY;
        this._endpoints = new Map(endpoints.map((endpoint) => [endpoint.name, endpoint] as const));
    }

    public async login(webshopInfo = false): Promise<ILoginResponse> {
        return this._call<ILoginRequest, ILoginResponse>("login", { apiKey: this._config.apiKey, webshopInfo });
    }

    public async getProductDB(request: IGetProductDBRequest = {}): Promise<string> {
        return this._call<IGetProductDBRequest, string>("getProductDB", request);
    }

    public async setProduct(request: ISetProductRequest): Promise<ISetProductResponse[]> {
        return this._call<ISetProductRequest, ISetProductResponse[]>("setProduct", request);
    }

    public async getWarehouse(request?: IGetWarehouseRequest): Promise<IWarehouseResponse[]> {
        return this._call<IGetWarehouseRequest | undefined, IWarehouseResponse[]>("getWarehouse", request);
    }

    public async setWarehouse(request: ISetWarehouseRequest): Promise<ISetWarehouseResponse[]> {
        return this._call<ISetWarehouseRequest, ISetWarehouseResponse[]>("setWarehouse", request);
    }

    private async _call<TRequest, TResponse>(name: string, request: TRequest): Promise<TResponse> {
        const endpoint = this._endpoints.get(name) as IUnasEndpoint<TRequest, TResponse> | undefined;
        if (!endpoint) {
            throw new UnasConfigError(`Unknown UNAS endpoint: ${name}`);
        }
        if (endpoint.requiresAuth) {
            return this.withAuthRetry((token) => this.execute(endpoint, request, token));
        }
        return this.execute(endpoint, request, undefined);
    }

    private async withAuthRetry<T>(op: (token: string) => Promise<T>): Promise<T> {
        let token = await this.getToken();
        try {
            return await op(token);
        } catch (error) {
            if (!(error instanceof UnasHttpError) || error.status !== 400) {
                throw error;
            }
            this._logger.warn("UNAS token expired, refreshing", { url: error.url, status: error.status });
            token = await this.fetchAndStoreToken();
            try {
                return await op(token);
            } catch (retryError) {
                throw new UnasAuthError("UNAS request failed after token refresh", { cause: retryError });
            }
        }
    }

    private async getToken(): Promise<string> {
        const token = await this._tokenStore.get(this._tokenKey);
        if (token) {
            return token;
        }
        this._logger.info("UNAS token not found, requesting new token");
        return this.fetchAndStoreToken();
    }

    private async fetchAndStoreToken(): Promise<string> {
        const { token } = await this.login();
        await this._tokenStore.set(this._tokenKey, token);
        return token;
    }

    private async execute<TRequest, TResponse>(
        endpoint: IUnasEndpoint<TRequest, TResponse>,
        request: TRequest,
        token?: string,
    ): Promise<TResponse> {
        const url = this.buildUrl(endpoint.name);
        const body = endpoint.buildRequest(request);
        this._logger.info("UNAS request", { name: endpoint.name, url });

        if (this._isDebugLoggingEnabled()) {
            this._logDebugRequest(url, body);
        }

        let response: IUnasHttpResponse;
        try {
            response = await this._httpClient.post(url, body, token ? { Authorization: `Bearer ${token}` } : undefined);
        } catch (error) {
            this._logger.error("UNAS transport error", { name: endpoint.name, url, error });
            throw new UnasTransportError(`UNAS transport error for ${endpoint.name}`, { cause: error });
        }

        if (this._isDebugLoggingEnabled()) {
            this._logDebugResponse(url, response.status, response.data);
        }

        if (response.status !== 200) {
            throw this.createHttpError(response, url);
        }

        return endpoint.parseResponse(response.data);
    }

    private _isDebugLoggingEnabled(): boolean {
        const flag = process.env.DEBUG_UNAS_JSON_CLIENT?.trim().toLowerCase();
        return flag !== undefined && flag !== "" && flag !== "0" && flag !== "false";
    }

    private _logDebugRequest(url: string, body: string | undefined): void {
        const sanitizedBody = body !== undefined ? this._maskSensitiveXml(body) : "(empty)";
        console.log(`[DEBUG_UNAS_JSON_CLIENT] >>> REQUEST to: ${url}\n${sanitizedBody}`);
        this._logger.debug("UNAS debug request", { url, body: sanitizedBody });
    }

    private _logDebugResponse(url: string, status: number, data: string): void {
        console.log(`[DEBUG_UNAS_JSON_CLIENT] <<< RESPONSE from: ${url} (Status: ${status})\n${data}`);
        this._logger.debug("UNAS debug response", { url, status, data });
    }

    private _maskSensitiveXml(xml: string): string {
        return xml.replace(/<ApiKey>[\s\S]*?<\/ApiKey>/gi, "<ApiKey>***REDACTED***</ApiKey>");
    }

    private createHttpError(response: IUnasHttpResponse, url: string): UnasHttpError {
        let unasErrorMessage: string | undefined;
        try {
            const parsed = this._xmlService.parse<{ Error?: string | { ErrorMessage?: string } }>(response.data);
            if (parsed.Error !== undefined) {
                unasErrorMessage = typeof parsed.Error === "string" ? parsed.Error : parsed.Error.ErrorMessage;
            }
        } catch {
            // Body wasn't parseable XML — leave unasErrorMessage undefined.
        }
        this._logger.error("UNAS HTTP error", { url, status: response.status, unasErrorMessage });
        return new UnasHttpError(`UNAS request failed with status ${response.status}`, response.status, url, {
            responseBody: response.data,
            unasErrorMessage,
        });
    }

    private buildUrl(endpointName: string): string {
        return `${this._baseUrl}${endpointName}`;
    }
}
