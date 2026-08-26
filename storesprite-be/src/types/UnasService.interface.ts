import type { IUnasJsonClientConfig, ILoginResponse } from "@storesprite/unas-json-client";

export interface IUnasService {
  login(config: IUnasJsonClientConfig): Promise<ILoginResponse>;
}
