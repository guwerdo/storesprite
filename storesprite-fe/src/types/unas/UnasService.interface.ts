import type { IUnasLoginResponse, IUnasWarehouseResponse } from './UnasConnection.interface.js';

export interface IUnasService {
  login(token: string): Promise<IUnasLoginResponse>;
  getWarehouses(token: string): Promise<IUnasWarehouseResponse>;
}
