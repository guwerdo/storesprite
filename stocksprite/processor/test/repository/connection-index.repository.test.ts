import { describe, expect, it } from "vitest";
import { ConnectionIndexRepository } from "../../src/repository/connection-index.repository.js";

describe("ConnectionIndexRepository", () => {
    it("appends duplicate sku states in order", () => {
        const index = new ConnectionIndexRepository();
        index.add("A", new Map([[1, 5]]));
        index.add("A", new Map([[1, 6]]));
        expect(index.get("A")).toHaveLength(2);
        expect([...(index.get("A")?.[1] ?? [])]).toEqual([[1, 6]]);
    });

    it("returns undefined for an unknown sku and deletes correctly", () => {
        const index = new ConnectionIndexRepository();
        expect(index.get("missing")).toBeUndefined();
        index.add("A", new Map([[1, 5]]));
        expect(index.delete("A")).toBe(true);
        expect(index.get("A")).toBeUndefined();
        expect(index.delete("A")).toBe(false);
    });

    it("tracks size, keys, and clear", () => {
        const index = new ConnectionIndexRepository();
        index.add("A", new Map([[1, 1]]));
        index.add("B", new Map([[1, 2]]));
        expect(index.size).toBe(2);
        expect([...index.keys()].sort()).toEqual(["A", "B"]);
        index.clear();
        expect(index.size).toBe(0);
    });
});
