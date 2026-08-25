import { Container } from "inversify";
import type { IUnasJsonClient } from "../client/unas-json-client.interface.js";
import type { IUnasJsonClientConfig } from "../config/unas-json-client-config.interface.js";
import type { IUnasHttpClient } from "../core/unas-http-client.interface.js";
import type { ILogger } from "../core/logger.interface.js";
import type { ITokenStore } from "../core/token-store.interface.js";
import type { IXmlService } from "../core/xml-service.interface.js";
import { TYPES } from "../types/binding-keys.js";
import { registerUnasJsonClient } from "./register-unas-json-client.js";

export interface IUnasJsonClientOverrides {
    httpClient?: IUnasHttpClient;
    tokenStore?: ITokenStore;
    logger?: ILogger;
    xmlService?: IXmlService;
}

/** Non-Inversify facade — the caller never imports `inversify`. */
export function createUnasJsonClient(config: IUnasJsonClientConfig, overrides?: IUnasJsonClientOverrides): IUnasJsonClient {
    const container = new Container();
    if (overrides?.httpClient) {
        container.bind(TYPES.IUnasHttpClient).toConstantValue(overrides.httpClient);
    }
    if (overrides?.tokenStore) {
        container.bind(TYPES.ITokenStore).toConstantValue(overrides.tokenStore);
    }
    if (overrides?.logger) {
        container.bind(TYPES.ILogger).toConstantValue(overrides.logger);
    }
    if (overrides?.xmlService) {
        container.bind(TYPES.IXmlService).toConstantValue(overrides.xmlService);
    }
    registerUnasJsonClient(container, config);
    return container.get<IUnasJsonClient>(TYPES.IUnasJsonClient);
}
