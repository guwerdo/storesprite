export interface ILoginRequest {
    apiKey: string;
    /** When true, include <WebshopInfo>true</WebshopInfo> in the request; otherwise omit it. */
    webshopInfo?: boolean;
}

export interface ILoginResponse {
    token: string;
    expire: string;
    expireTime: number;
    shopId: number;
    subscription: string;
    permissions: string[];
    status: string;
    webshopInfo?: IWebshopInfo;
}

export interface IWebshopInfo {
    webshopName: string;
    webshopUrl: string;
    contact: IWebshopContact;
    trader: IWebshopTrader;
    languages: IWebshopLanguage[];
}

export interface IWebshopContact {
    name: string;
    email: string;
    phone: string;
    mobile: string;
}

export interface IWebshopTrader {
    name: string;
    country: string;
    zip: string;
    county: string;
    city: string;
    address: string;
    phone: string;
    fax: string;
    defaultCurrency: string;
    vat: string;
    euVat: string;
    email: string;
    registrationNumber: string;
    registrationCourt: string;
    licenseNumber: string;
    registrationDate: string;
    bankAccount: string;
    iban: string;
    website: string;
}

export interface IWebshopLanguage {
    code: string;
    default: string;
}
