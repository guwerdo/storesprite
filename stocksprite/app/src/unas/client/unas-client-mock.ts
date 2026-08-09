import { injectable, inject } from "inversify";
import { IProductElement} from "./request/index.js";
import { UnasClient } from "./index.js";
import { IProductElementResponse } from "./response/index.js";
import { IAxiosHttpClient } from "../../http-client/interfaces/http-client.interface.js";
import { Logger } from "log4js";
import { BindingKeys } from "../../types/index.js";
import { IRepository } from "../../repository/index.js";

@injectable()

export class UnasClientMock extends UnasClient {
    constructor(
        @inject(BindingKeys.IAxiosHttpClient) httpClient: IAxiosHttpClient,
        @inject(BindingKeys.SettingsRepository) settingsRepository: IRepository<string>,
        @inject(BindingKeys.Logger) logger: Logger
    ) {
        super(httpClient, settingsRepository, logger);
    }

    public override async setProduct(request: string): Promise<IProductElementResponse[]> {
        await new Promise(resolve => setTimeout(resolve, 1)); // Mock async task for async method compatibility        
        const requestXml = this._xmlParser.parse(request) as { Products: { Product: IProductElement[] } };
        const productElements: IProductElement[] = requestXml.Products.Product;

        // Create a mocked response from the request with ok status
        const productElementResponses: IProductElementResponse[] = [];
        for (const productElement of productElements) {
            productElementResponses.push({
                Id: "mocked-id",
                Sku: productElement.Sku,
                Action: productElement.Action,
                Status: "ok"
            });
        }

        return productElementResponses;
    }
}
