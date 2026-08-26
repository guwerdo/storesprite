import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import type { IHttpClient } from '../types/HttpClient.interface.js';
import type { IUnasService } from '../types/UnasService.interface.js';
import type { IUnasLoginResponse } from '../types/UnasConnection.interface.js';
import { TYPES } from '../di/types.js';

@injectable()
export class UnasService implements IUnasService {
  constructor(
    @inject(TYPES.IHttpClient)
    private readonly _httpClient: IHttpClient
  ) {}

  async login(token: string): Promise<IUnasLoginResponse> {
    return this._httpClient.post<IUnasLoginResponse>('/client/unas/login', {}, {
      Authorization: `Bearer ${token}`,
    });
  }
}
