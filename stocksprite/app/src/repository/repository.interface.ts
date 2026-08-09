export interface IRepository<T> {
    get(key: string): Promise<T | undefined>;
    getAll(): Promise<T[] | undefined>;
    add(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
    exists(key: string, value: string): Promise<boolean>;
}
