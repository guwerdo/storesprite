import log4js from "log4js";
import type { LoggingEvent, Logger } from "log4js";

const LOG_CATEGORIES = ["default", "parse", "compare", "send"] as const;

/**
 * Single-line JSON layout: { ts, level, category, msg, context }. The second
 * log4js argument (an object) becomes `context`. The processor is ephemeral and
 * runs on a tmpfs, so logs go to the console (stdout → Cloud Logging) only —
 * no file appender, no durable disk.
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

export function configureLogger(): void {
    log4js.addLayout("jsonWithDataField", jsonWithDataFieldLayout);
    const categories: Record<string, log4js.Configuration["categories"][string]> = {};
    for (const category of LOG_CATEGORIES) {
        categories[category] = { appenders: ["console"], level: process.env.LOG_LEVEL ?? "info" };
    }
    log4js.configure({
        appenders: {
            console: { type: "console", layout: { type: "jsonWithDataField" } },
        },
        categories,
    });
}

export function getLogger(category = "default"): Logger {
    return log4js.getLogger(category);
}
