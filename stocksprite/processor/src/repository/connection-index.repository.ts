import { injectable } from "inversify";

/**
 * The single resident structure of the run: sku -> every desired stock state
 * declared for it by the supplier feed. The UNAS product-database CSV is never
 * materialized — each row is looked up here and the entry is deleted once it
 * has been compared.
 */
@injectable()
export class ConnectionIndexRepository {
    private readonly _bySku = new Map<string, Map<number, number>[]>();

    public add(sku: string, desired: Map<number, number>): void {
        const existing = this._bySku.get(sku);
        if (existing) {
            existing.push(desired);
            return;
        }
        this._bySku.set(sku, [desired]);
    }

    public get(sku: string): Map<number, number>[] | undefined {
        return this._bySku.get(sku);
    }

    public delete(sku: string): boolean {
        return this._bySku.delete(sku);
    }

    public clear(): void {
        this._bySku.clear();
    }

    public get size(): number {
        return this._bySku.size;
    }

    public keys(): IterableIterator<string> {
        return this._bySku.keys();
    }
}
