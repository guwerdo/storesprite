import type { ISettingsApiResponse, ISaveSettingsRequest, ISaveSettingsResponse } from './Setting.interface.js';

export interface ISettingService {
  getSettings(token: string): Promise<ISettingsApiResponse>;
  saveSettings(token: string, payload: ISaveSettingsRequest): Promise<ISaveSettingsResponse>;
}
