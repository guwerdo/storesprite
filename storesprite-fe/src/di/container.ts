import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types.js';
import type { IHttpClient } from '../types/HttpClient.interface.js';
import type { ISettingService } from '../types/SettingService.interface.js';
import { AxiosClient } from '../services/AxiosClient.js';
import { MockHttpClient } from '../services/MockHttpClient.js';
import { SettingService } from '../services/SettingService.js';

const container = new Container();

container.bind<IHttpClient>(TYPES.IHttpClient).to(AxiosClient).inSingletonScope();
container.bind<ISettingService>(TYPES.ISettingService).to(SettingService).inSingletonScope();

const useMock = (import.meta.env.VITE_USE_MOCK_CLIENT as string | undefined) === 'true';
if (useMock) {
  container.rebind<IHttpClient>(TYPES.IHttpClient).to(MockHttpClient).inSingletonScope();
}

export { container };
