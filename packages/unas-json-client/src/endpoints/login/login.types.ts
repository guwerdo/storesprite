export interface ILoginRequest {
    apiKey: string;
    webshopInfo?: boolean; // default true
}

export interface ILoginResponse {
    token: string;
}
