import type { IUnasHttpClient, IUnasHttpResponse } from "../../src/core/unas-http-client.interface.js";

export interface IRecordedRequest {
    url: string;
    body: string | undefined;
    headers?: Record<string, string>;
}

/** Records every post() and returns queued responses per URL (FIFO). */
export class FakeUnasHttpClient implements IUnasHttpClient {
    public readonly requests: IRecordedRequest[] = [];
    private readonly _responses = new Map<string, IUnasHttpResponse[]>();

    public enqueue(url: string, response: IUnasHttpResponse): void {
        const queue = this._responses.get(url) ?? [];
        queue.push(response);
        this._responses.set(url, queue);
    }

    public async post(url: string, body: string | undefined, headers?: Record<string, string>): Promise<IUnasHttpResponse> {
        this.requests.push({ url, body, headers });
        const response = this._responses.get(url)?.shift();
        if (!response) {
            throw new Error(`FakeUnasHttpClient has no queued response for ${url}`);
        }
        return response;
    }
}
