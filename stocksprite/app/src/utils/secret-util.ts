import fs from "fs";
import path from "path";

export function getUnasApiKey(): string {
    return readSecret("unas-api-key").toString();
}

function readSecret(name: string): Buffer {
    const secretPath = path.join("/run/secrets", name);
    return fs.readFileSync(secretPath);
}
