import { createHash } from "crypto";

export function createShortHash(value: string): string {
    const fullHash = createHash("sha256").update(value).digest();
    const short = fullHash.subarray(0, 16);
    return short.toString("hex");
}
