export interface IUnasHttpResponse {
    status: number;
    data: string;
}

export interface IUnasHttpClient {
    post(url: string, body: string | undefined, headers?: Record<string, string>): Promise<IUnasHttpResponse>;
}
