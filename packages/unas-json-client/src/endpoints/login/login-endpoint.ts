import { inject, injectable } from "inversify";
import type { IUnasEndpoint } from "../../core/unas-endpoint.interface.js";
import type { IXmlService } from "../../core/xml-service.interface.js";
import { TYPES } from "../../types/binding-keys.js";
import { UnasParseError } from "../../types/errors.js";
import type { ILoginRequest, ILoginResponse } from "./login.types.js";

interface ILoginContent {
    Login?: { Token?: string };
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
                WebshopInfo: request.webshopInfo === false ? "false" : "true",
            },
        });
    }

    public parseResponse(xml: string): ILoginResponse {
        const parsed = this._xml.parse<ILoginContent>(xml);
        const token = parsed.Login?.Token;
        if (!token) {
            throw new UnasParseError("login response missing <Login><Token>");
        }
        return { token };
    }
}
