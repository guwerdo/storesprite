import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types.js';
import type { IHttpClient } from '../types/HttpClient.interface.js';
import type { ISettingService } from '../types/user/SettingService.interface.js';
import type { IConnectionService } from '../types/stocksprite/ConnectionService.interface.js';
import type { ISocketService } from '../types/SocketService.interface.js';
import type { IUnasService } from '../types/unas/UnasService.interface.js';
import type { IMappingService } from '../types/stocksprite/MappingService.interface.js';
import { AxiosClient } from '../services/AxiosClient.js';
import { MockHttpClient } from '../services/MockHttpClient.js';
import { SettingService } from '../services/user/SettingService.js';
import { ConnectionService } from '../services/stocksprite/ConnectionService.js';
import { SocketService } from '../services/SocketService.js';
import { UnasService } from '../services/unas/UnasService.js';
import { MappingService } from '../services/stocksprite/MappingService.js';

const container = new Container();

container.bind<IHttpClient>(TYPES.IHttpClient).to(AxiosClient).inSingletonScope();
container.bind<ISettingService>(TYPES.ISettingService).to(SettingService).inSingletonScope();
container.bind<IConnectionService>(TYPES.IConnectionService).to(ConnectionService).inSingletonScope();
container.bind<ISocketService>(TYPES.ISocketService).to(SocketService).inSingletonScope();
container.bind<IUnasService>(TYPES.IUnasService).to(UnasService).inSingletonScope();
container.bind<IMappingService>(TYPES.IMappingService).to(MappingService).inSingletonScope();

const useMock = (import.meta.env.VITE_USE_MOCK_CLIENT as string | undefined) === 'true';
if (useMock) {
  container.rebind<IHttpClient>(TYPES.IHttpClient).to(MockHttpClient).inSingletonScope();
}

export { container };
