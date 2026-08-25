import axios, { type AxiosInstance } from "axios";
import { injectable } from "inversify";
import type { IUnasHttpClient, IUnasHttpResponse } from "../core/unas-http-client.interface.js";

@injectable()
export class AxiosUnasHttpClient implements IUnasHttpClient {
    private readonly _instance: AxiosInstance;

    constructor() {
        // `validateStatus: () => true` keeps non-2xx as a response (not a thrown AxiosError),
        // so the client's status check is the single source of truth for HTTP errors.
        this._instance = axios.create({ validateStatus: () => true });
    }

    public async post(url: string, body: string | undefined, headers?: Record<string, string>): Promise<IUnasHttpResponse> {
        const response = await this._instance.post<string>(url, body, headers ? { headers } : undefined);
        return { status: response.status, data: response.data };
    }
}
