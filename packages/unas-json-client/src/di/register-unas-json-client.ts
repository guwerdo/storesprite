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

function bindDefault<T>(container: Container, symbol: symbol, impl: new () => T): void {
    if (!container.isBound(symbol)) {
        container.bind<T>(symbol).to(impl).inSingletonScope();
    }
}

export function registerUnasJsonClient(container: Container, config: IUnasJsonClientConfig): Container {
    if (!container.isBound(TYPES.IUnasJsonClientConfig)) {
        container.bind(TYPES.IUnasJsonClientConfig).toConstantValue(config);
    }
    bindDefault(container, TYPES.IUnasHttpClient, AxiosUnasHttpClient);
    bindDefault(container, TYPES.ITokenStore, InMemoryTokenStore);
    bindDefault(container, TYPES.ILogger, ConsoleLogger);
    bindDefault(container, TYPES.IXmlService, FastXmlService);

    for (const Endpoint of [LoginEndpoint, GetProductDbEndpoint, GetWarehouseEndpoint, SetProductEndpoint]) {
        container.bind<IUnasEndpoint>(TYPES.UnasEndpoint).to(Endpoint).inSingletonScope();
    }

    if (!container.isBound(TYPES.IUnasJsonClient)) {
        container.bind(TYPES.IUnasJsonClient).to(UnasJsonClient).inSingletonScope();
    }

    return container;
}
