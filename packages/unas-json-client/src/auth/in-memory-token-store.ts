import { injectable } from "inversify";
import type { ITokenStore } from "../core/token-store.interface.js";

@injectable()
export class InMemoryTokenStore implements ITokenStore {
    private readonly _tokens = new Map<string, string>();

    public get(key: string): Promise<string | undefined> {
        return Promise.resolve(this._tokens.get(key));
    }

    public set(key: string, value: string): Promise<void> {
        this._tokens.set(key, value);
        return Promise.resolve();
    }
}
