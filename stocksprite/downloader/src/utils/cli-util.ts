import fs from "node:fs";
import { spawn } from "node:child_process";

export interface SpawnCliOptions {
  command: string;
  args: string[];
  outputFilePath?: string;
  inputFilePath?: string;
}

export class CliUtil {
  public static async executeCommand(options: SpawnCliOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const { command, args, outputFilePath, inputFilePath } = options;

      let inputStream: fs.ReadStream | null = null;
      let outputStream: fs.WriteStream | null = null;

      if (outputFilePath) {
        outputStream = fs.createWriteStream(outputFilePath);
      }

      const proc = spawn(command, args, {
        stdio: [inputFilePath ? "pipe" : "ignore", outputStream ? "pipe" : "inherit", "pipe"],
      });

      let stderrOutput = "";
      proc.stderr?.on("data", (chunk: Buffer) => {
        stderrOutput += chunk.toString("utf-8");
      });

      if (inputFilePath && proc.stdin) {
        inputStream = fs.createReadStream(inputFilePath);
        inputStream.pipe(proc.stdin);
      }

      if (outputStream && proc.stdout) {
        proc.stdout.pipe(outputStream);
      }

      proc.on("error", (err) => {
        if (outputStream) outputStream.close();
        if (inputStream) inputStream.close();
        reject(new Error(`Failed to start command '${command}': ${err.message}`));
      });

      proc.on("close", (code) => {
        if (outputStream) {
          outputStream.close();
        }
        if (inputStream) {
          inputStream.close();
        }

        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `Command '${command} ${args.join(" ")}' exited with code ${code}. Error: ${stderrOutput.trim()}`
            )
          );
        }
      });
    });
  }
}
