import type { IUnasLoginResponse } from './UnasConnection.interface.js';

export interface IUnasService {
  login(token: string): Promise<IUnasLoginResponse>;
}
