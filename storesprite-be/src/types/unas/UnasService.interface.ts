import type { UnasConnectionRecord } from "./UnasConnection.interface.js";
import type { IWarehouseResponse } from "@storesprite/unas-json-client";

export interface IUnasService {
  login(userId: string): Promise<UnasConnectionRecord>;
  getWarehouses(userId: string): Promise<IWarehouseResponse[]>;
}
