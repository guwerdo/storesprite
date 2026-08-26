import { inject, injectable } from "inversify";
import type { IUnasEndpoint } from "../../core/unas-endpoint.interface.js";
import type { IXmlService } from "../../core/xml-service.interface.js";
import { TYPES } from "../../types/binding-keys.js";
import { UnasParseError } from "../../types/errors.js";
import type { ILoginRequest, ILoginResponse, IWebshopInfo } from "./login.types.js";

interface ILoginContent {
    Login?: {
        Token: string;
        Expire: string;
        ExpireTime: string;
        ShopId: string;
        Subscription: string;
        Permissions?: { Permission: string[] };
        WebshopInfo?: IWebshopInfoContent;
        Status: string;
    };
}

interface IWebshopInfoContent {
    WebshopName: string;
    WebshopURL: string;
    Contact: { Name: string; Email: string; Phone: string; Mobile: string };
    Trader: ITraderContent;
    Languages?: { Language: ILanguageContent[] };
}

interface ITraderContent {
    Name: string;
    Country: string;
    ZIP: string;
    County: string;
    City: string;
    Address: string;
    Phone: string;
    Fax: string;
    DefaultCurrency: string;
    VAT: string;
    EUVAT: string;
    Email: string;
    RegistrationNumber: string;
    RegistrationCourt: string;
    LicenseNumber: string;
    RegistrationDate: string;
    BankAccount: string;
    IBAN: string;
    Website: string;
}

interface ILanguageContent {
    Code: string;
    Default: string;
}

function mapWebshopInfo(info: IWebshopInfoContent): IWebshopInfo {
    return {
        webshopName: info.WebshopName,
        webshopUrl: info.WebshopURL,
        contact: {
            name: info.Contact.Name,
            email: info.Contact.Email,
            phone: info.Contact.Phone,
            mobile: info.Contact.Mobile,
        },
        trader: {
            name: info.Trader.Name,
            country: info.Trader.Country,
            zip: info.Trader.ZIP,
            county: info.Trader.County,
            city: info.Trader.City,
            address: info.Trader.Address,
            phone: info.Trader.Phone,
            fax: info.Trader.Fax,
            defaultCurrency: info.Trader.DefaultCurrency,
            vat: info.Trader.VAT,
            euVat: info.Trader.EUVAT,
            email: info.Trader.Email,
            registrationNumber: info.Trader.RegistrationNumber,
            registrationCourt: info.Trader.RegistrationCourt,
            licenseNumber: info.Trader.LicenseNumber,
            registrationDate: info.Trader.RegistrationDate,
            bankAccount: info.Trader.BankAccount,
            iban: info.Trader.IBAN,
            website: info.Trader.Website,
        },
        languages: (info.Languages?.Language ?? []).map((lang) => ({
            code: lang.Code,
            default: lang.Default,
        })),
    };
}

@injectable()
export class LoginEndpoint implements IUnasEndpoint<ILoginRequest, ILoginResponse> {
    public readonly name = "login";
    public readonly requiresAuth = false;

    constructor(@inject(TYPES.IXmlService) private readonly _xml: IXmlService) {}

    public buildRequest(request: ILoginRequest): string {
        return this._xml.buildDocument({
            Params: {
                ApiKey: request.apiKey,
                ...(request.webshopInfo === true ? { WebshopInfo: "true" } : {}),
            },
        });
    }

    public parseResponse(xml: string): ILoginResponse {
        const parsed = this._xml.parse<ILoginContent>(xml);
        const login = parsed.Login;
        if (!login?.Token) {
            throw new UnasParseError("login response missing <Login><Token>");
        }
        return {
            token: login.Token,
            expire: login.Expire,
            expireTime: Number(login.ExpireTime),
            shopId: Number(login.ShopId),
            subscription: login.Subscription,
            permissions: login.Permissions?.Permission ?? [],
            status: login.Status,
            webshopInfo: login.WebshopInfo ? mapWebshopInfo(login.WebshopInfo) : undefined,
        };
    }
}
