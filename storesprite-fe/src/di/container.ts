import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types.js';
import type { IHttpClient } from '../services/IHttpClient.js';
import { AxiosClient } from '../services/AxiosClient.js';

const container = new Container();

container.bind<IHttpClient>(TYPES.IHttpClient).to(AxiosClient).inSingletonScope();

export { container };
