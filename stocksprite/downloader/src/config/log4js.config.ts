import path from "node:path";
import fs from "node:fs";
import log4js from "log4js";

export function configureLogger(outputDir: string): log4js.Logger {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const logFilePath = path.join(outputDir, "downloader.log");

  log4js.configure({
    appenders: {
      stdout: {
        type: "stdout",
        layout: {
          type: "pattern",
          pattern: "%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m",
        },
      },
      file: {
        type: "file",
        filename: logFilePath,
        maxLogSize: 10 * 1024 * 1024,
        backups: 3,
        compress: false,
        layout: {
          type: "pattern",
          pattern: "%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m",
        },
      },
    },
    categories: {
      default: {
        appenders: ["stdout", "file"],
        level: process.env.LOG_LEVEL || "info",
      },
    },
  });

  return log4js.getLogger("downloader");
}
