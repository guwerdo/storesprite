import fs from "node:fs";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable, Writable } from "node:stream";

export class StreamUtil {
  public static async pipelineAsync(source: Readable, destination: Writable): Promise<void> {
    await pipeline(source, destination);
  }

  public static async computeFileSha256(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
      return "";
    }

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", (err) => reject(err));
    });
  }

  public static async compareFileHash(fileA: string, fileB: string): Promise<boolean> {
    if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) {
      return false;
    }

    const [hashA, hashB] = await Promise.all([
      this.computeFileSha256(fileA),
      this.computeFileSha256(fileB),
    ]);

    return hashA.length > 0 && hashA === hashB;
  }
}
