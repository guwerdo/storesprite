import type { Container } from "inversify";
import { InMemoryTokenStore } from "../auth/in-memory-token-store.js";
import { UnasJsonClient } from "../client/unas-json-client.js";
import type { IUnasJsonClientConfig } from "../config/unas-json-client-config.interface.js";
import type { IUnasEndpoint } from "../core/unas-endpoint.interface.js";
import { GetProductDbEndpoint } from "../endpoints/get-product-db/get-product-db-endpoint.js";
import { GetWarehouseEndpoint } from "../endpoints/get-warehouse/get-warehouse-endpoint.js";
import { LoginEndpoint } from "../endpoints/login/login-endpoint.js";
import { SetProductEndpoint } from "../endpoints/set-product/set-product-endpoint.js";
import { AxiosUnasHttpClient } from "../http/axios-unas-http-client.js";
import { ConsoleLogger } from "../logging/console-logger.js";
import { TYPES } from "../types/binding-keys.js";
import { FastXmlService } from "../xml/fast-xml-service.js";

export function registerUnasJsonClient(container: Container, config: IUnasJsonClientConfig): Container {
    if (!container.isBound(TYPES.IUnasJsonClientConfig)) {
        container.bind(TYPES.IUnasJsonClientConfig).toConstantValue(config);
    }
    if (!container.isBound(TYPES.IUnasHttpClient)) {
        container.bind(TYPES.IUnasHttpClient).to(AxiosUnasHttpClient).inSingletonScope();
    }
    if (!container.isBound(TYPES.ITokenStore)) {
        container.bind(TYPES.ITokenStore).to(InMemoryTokenStore).inSingletonScope();
    }
    if (!container.isBound(TYPES.ILogger)) {
        container.bind(TYPES.ILogger).to(ConsoleLogger).inSingletonScope();
    }
    if (!container.isBound(TYPES.IXmlService)) {
        container.bind(TYPES.IXmlService).to(FastXmlService).inSingletonScope();
    }

    container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(LoginEndpoint).inSingletonScope();
    container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(GetProductDbEndpoint).inSingletonScope();
    container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(GetWarehouseEndpoint).inSingletonScope();
    container.bind<IUnasEndpoint<unknown, unknown>>(TYPES.UnasEndpoint).to(SetProductEndpoint).inSingletonScope();

    if (!container.isBound(TYPES.IUnasJsonClient)) {
        container.bind(TYPES.IUnasJsonClient).to(UnasJsonClient).inSingletonScope();
    }

    return container;
}
