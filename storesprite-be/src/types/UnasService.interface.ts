import type { UnasConnectionRecord } from "./UnasConnection.interface.js";

export interface IUnasService {
  login(userId: string): Promise<UnasConnectionRecord>;
}
