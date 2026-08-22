import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types.js';
import type { IHttpClient } from '../types/HttpClient.interface.js';
import type { ISettingService } from '../types/SettingService.interface.js';
import type { IConnectionService } from '../types/ConnectionService.interface.js';
import type { ISocketService } from '../types/SocketService.interface.js';
import { AxiosClient } from '../services/AxiosClient.js';
import { MockHttpClient } from '../services/MockHttpClient.js';
import { SettingService } from '../services/SettingService.js';
import { ConnectionService } from '../services/ConnectionService.js';
import { SocketService } from '../services/SocketService.js';

const container = new Container();

container.bind<IHttpClient>(TYPES.IHttpClient).to(AxiosClient).inSingletonScope();
container.bind<ISettingService>(TYPES.ISettingService).to(SettingService).inSingletonScope();
container.bind<IConnectionService>(TYPES.IConnectionService).to(ConnectionService).inSingletonScope();
container.bind<ISocketService>(TYPES.ISocketService).to(SocketService).inSingletonScope();

const useMock = (import.meta.env.VITE_USE_MOCK_CLIENT as string | undefined) === 'true';
if (useMock) {
  container.rebind<IHttpClient>(TYPES.IHttpClient).to(MockHttpClient).inSingletonScope();
}

export { container };
