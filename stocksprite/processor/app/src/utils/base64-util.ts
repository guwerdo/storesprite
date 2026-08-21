export function b64Encode(data: string): string {
    return Buffer.from(data, "utf-8").toString("base64");
}

export function b64Decode(data: string): string {
    return Buffer.from(data, "base64").toString("utf-8");
}
