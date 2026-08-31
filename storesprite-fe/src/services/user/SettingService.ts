import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import type { IHttpClient } from '../../types/HttpClient.interface.js';
import type { ISettingService } from '../../types/user/SettingService.interface.js';
import type { ISettingsApiResponse, ISaveSettingsRequest, ISaveSettingsResponse } from '../../types/user/Setting.interface.js';
import { TYPES } from '../../di/types.js';

@injectable()
export class SettingService implements ISettingService {
  constructor(
    @inject(TYPES.IHttpClient)
    private readonly _httpClient: IHttpClient
  ) {}

  async getSettings(token: string): Promise<ISettingsApiResponse> {
    return this._httpClient.get<ISettingsApiResponse>('/client/settings', {
      Authorization: `Bearer ${token}`,
    });
  }

  async saveSettings(token: string, payload: ISaveSettingsRequest): Promise<ISaveSettingsResponse> {
    return this._httpClient.put<ISaveSettingsResponse>('/client/settings', payload, {
      Authorization: `Bearer ${token}`,
    });
  }
}
