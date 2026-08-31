import type { IUnasJsonClient, IUnasJsonClientConfig } from "@storesprite/unas-json-client";

export interface IUnasClientFactory {
  create(config: IUnasJsonClientConfig): IUnasJsonClient;
}
