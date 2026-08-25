import { describe, expect, it } from "vitest";
import { InMemoryTokenStore } from "./in-memory-token-store.js";

describe("InMemoryTokenStore", () => {
    it("returns undefined for a missing key and round-trips a value", async () => {
        const store = new InMemoryTokenStore();
        expect(await store.get("unasToken")).toBeUndefined();
        await store.set("unasToken", "tok");
        expect(await store.get("unasToken")).toBe("tok");
    });
});
