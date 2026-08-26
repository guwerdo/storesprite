import type { IWebshopInfo } from "@storesprite/unas-json-client";

export interface IUnasService {
  login(userId: string): Promise<IWebshopInfo | null>;
}
