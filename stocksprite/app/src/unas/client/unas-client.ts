import { inject, injectable } from "inversify";
import { IUnasClient } from "./interfaces/unas-client.interface.js";
import { getProductDb, login } from "./request/index.js";
import type { IAxiosHttpClient } from "../../http-client/interfaces/http-client.interface.js";
import { X2jOptions, XMLParser } from "fast-xml-parser";
import { createEndpoints } from "./endpoints.js";
import { IGetProductDbContent, ILoginContent, IProductElementResponse, IWarehouseElementResponse } from "./response/index.js";
import type { Logger } from "log4js";
import { exit } from "process";
import { HttpError } from "../../types/http-error.type.js";
import { BindingKeys } from "../../types/index.js";
import { AxiosError, isAxiosError } from "axios";
import { Util } from "../../utils/index.js";
import type { IRepository } from "../../repository/interfaces/index.js";
import type { IConfiguration } from "../../configuration/interfaces/configuration.interface.js";

@injectable()
export class UnasClient implements IUnasClient {
    protected _xmlParser;
    protected _endpoints;

    constructor(
        @inject(BindingKeys.IConfiguration) private _configuration: IConfiguration,
        @inject(BindingKeys.IAxiosHttpClient) private _httpClient: IAxiosHttpClient,
        @inject(BindingKeys.SettingsRepository) private _settingsRepository: IRepository<string>,
        @inject(BindingKeys.Logger) private _logger: Logger)
        {
            const options: X2jOptions = {
                ignoreAttributes: false,
                isArray: (tagName: string) => {
                    return tagName == "Product";
                },
            };
            this._xmlParser = new XMLParser(options);
            this._endpoints = createEndpoints(this._configuration);
        }

    public async getProductDb(): Promise<string> {
        return this.withAuthRetry(async (token) => {
            const response = await this._httpClient.instance.post(
                this._endpoints.GET_PRODUCT_DB,
                getProductDb,
                this.createAuthHeaders(token)
            );
            if (response.status !== 200) {
                throw new HttpError("Failed to get product db", response.status);
            }
            const result = this._xmlParser.parse(response.data as string) as IGetProductDbContent;
            const url: string | undefined = result.getProductDB?.Url;
            if (!url) {
                throw new Error("URL is undefined in getProductDb response");
            }
            return url;
        });
    }

    public async setProduct(request: string): Promise<IProductElementResponse[]> {
        return this.withAuthRetry(async (token) => {
            const response = await this._httpClient.instance.post(
                this._endpoints.SET_PRODUCT,
                request,
                this.createAuthHeaders(token)
            );
            if (response.status !== 200) {
                throw new HttpError("Failed to set product", response.status);
            }
            const result = this._xmlParser.parse(response.data as string) as { Products: { Product: IProductElementResponse[] } };
            return result.Products.Product;
        });
    }

    public async getWarehouse(): Promise<IWarehouseElementResponse[]> {
        return this.withAuthRetry(async (token) => {
            const response = await this._httpClient.instance.post(
                this._endpoints.GET_WAREHOUSE,
                null,
                this.createAuthHeaders(token)
            );
            if (response.status !== 200) {
                throw new HttpError("Failed to get warehouse", response.status);
            }
            const result = this._xmlParser.parse(response.data as string) as { Warehouses: { Warehouse: IWarehouseElementResponse[] } };
            return result.Warehouses.Warehouse;
        });
    }

    private async login(): Promise<string> {
        const apiKey = Util.getUnasApiKey();

        try {
            const response = await this._httpClient.instance.post(this._endpoints.LOGIN, login(apiKey));
            if (response.status !== 200) {
                throw new Error(`Login failed: ${response.data}`);
            }
            const result = this._xmlParser.parse(response.data as string) as ILoginContent;
            const token: string | undefined = result.Login?.Token;
            if (!token) {
                throw new Error("Token is undefined");
            }

            return token;
        } catch (error) {
            throw error;
        }
    }

    private createAuthHeaders(token: string): { headers: { Authorization: string } } {
        return {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        };
    }

    private async withAuthRetry<T>(fn: (token: string) => Promise<T>): Promise<T> {
        let token = await this._settingsRepository.get("unasToken");
        if (!token) {
            this._logger.info("Unas api token not found, requesting new token");
            token = await this.login();
            await this._settingsRepository.add("unasToken", token);
        }
        else {
            this._logger.info("Using existing Unas api token");
        }
        try {
            return await fn(token);
        } catch (error: unknown) {
            if (error instanceof AxiosError && error.response?.status === 400) {
                this._logger.info("Unas api token expired, requesting new token");
                token = await this.login();
                await this._settingsRepository.add("unasToken", token);
                try {
                    return await fn(token);
                } catch (error: unknown) {
                    if (isAxiosError(error)) {
                        const respData = typeof error.response?.data === "string" ? error.response.data : Util.stringifyError(error.response?.data);
                        this._logger.error("Unas api request failed after retrying with new token", {
                            status: error.response?.status,
                            method: error.config?.method?.toUpperCase(),
                            url: error.config?.url,
                            responseData: respData,
                        });
                    } else {
                        this._logger.error("Unas api request failed after retrying with new token", { error: Util.stringifyError(error) });
                    }
                    exit(1);
                }
            }
            throw error;
        }
    }
}
