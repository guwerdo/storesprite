import fs from "node:fs";
import crypto from "node:crypto";

export class StreamUtil {
  public static async computeFileSha256(filePath: string): Promise<string> {
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

    // Differing sizes imply differing content; skip the expensive full-file hashing.
    if (fs.statSync(fileA).size !== fs.statSync(fileB).size) {
      return false;
    }

    const [hashA, hashB] = await Promise.all([
      this.computeFileSha256(fileA),
      this.computeFileSha256(fileB),
    ]);

    return hashA.length > 0 && hashA === hashB;
  }

  public static async commitDownloadedFile(tempFilePath: string, destinationPath: string): Promise<boolean> {
    let isUnchanged = false;
    if (fs.existsSync(destinationPath)) {
      isUnchanged = await this.compareFileHash(destinationPath, tempFilePath);
    }

    if (fs.existsSync(destinationPath)) {
      fs.unlinkSync(destinationPath);
    }
    fs.renameSync(tempFilePath, destinationPath);

    return isUnchanged;
  }
}
