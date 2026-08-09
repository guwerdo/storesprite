import { IRepository } from "./repository.interface.js";

export interface ICacheRepository<T> extends IRepository<T> {
    invalidateAll(): Promise<void>;
    removeInvalidated(): Promise<number>;
}
