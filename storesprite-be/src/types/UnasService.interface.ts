import type { IUnasJsonClientConfig, IWebshopInfo } from "@storesprite/unas-json-client";

export interface IUnasService {
  getWebshopInfo(config: IUnasJsonClientConfig): Promise<IWebshopInfo>;
}
