import path from "node:path";
import fs from "node:fs";
import log4js from "log4js";
import type { LoggingEvent } from "log4js";

/**
 * Single-line JSON layout: { ts, level, category, msg, context }. The second
 * log4js argument (an object) becomes `context`. Kept identical to the
 * processor's `jsonWithDataFieldLayout` so both ephemeral workers emit the same
 * structured shape. Each log is one physical line — a newline-bearing error
 * stack is JSON-escaped inside `context`, so a line-oriented log collector
 * (stdout → Cloud Logging / OpenSearch) never fragments a single entry.
 */
export function jsonWithDataFieldLayout(): (logEvent: LoggingEvent) => string {
    return (logEvent: LoggingEvent): string => {
        // log4js types logEvent.data as `any[]`, so every read is `any`. The strict
        // no-unsafe-assignment rule is noise here: we deliberately forward the raw
        // payload to JSON, and the runtime shape of each cell is validated below.
        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        const rawMessage = logEvent.data[0];
        const entry: Record<string, unknown> = {
            ts: new Date(logEvent.startTime).toISOString(),
            level: logEvent.level.levelStr,
            category: logEvent.categoryName,
            msg: typeof rawMessage === "string" ? rawMessage : "",
        };
        const extra = logEvent.data[1];
        if (extra !== null && typeof extra === "object" && !Array.isArray(extra)) {
            entry.context = extra;
        }
        /* eslint-enable @typescript-eslint/no-unsafe-assignment */
        return JSON.stringify(entry);
    };
}

export function configureLogger(outputDir: string): log4js.Logger {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const logFilePath = path.join(outputDir, "downloader.log");

    log4js.addLayout("jsonWithDataField", jsonWithDataFieldLayout);
    log4js.configure({
        appenders: {
            stdout: {
                type: "stdout",
                layout: { type: "jsonWithDataField" },
            },
            file: {
                type: "file",
                filename: logFilePath,
                maxLogSize: 10 * 1024 * 1024,
                backups: 3,
                compress: false,
                layout: { type: "jsonWithDataField" },
            },
        },
        categories: {
            // log4js requires a "default" category to be defined (fallback routing);
            // the downloader never logs under it. Every downloader log line instead
            // carries category "downloader" so log-system filters can tell downloader
            // logs from processor logs apart.
            default: {
                appenders: ["stdout", "file"],
                level: process.env.LOG_LEVEL || "info",
            },
            downloader: {
                appenders: ["stdout", "file"],
                level: process.env.LOG_LEVEL || "info",
            },
        },
    });

    return log4js.getLogger("downloader");
}
