import stringify from "fast-json-stable-stringify";
import type { LoggingEvent } from "log4js";

export function jsonWithDataFieldLayout() {
    return (logEvent: LoggingEvent): string => {
        const [message, extra]: [string, unknown] = logEvent.data as [string, unknown];

        interface LogEntry {
            ts: string;
            level: string;
            category: string;
            msg: string;
            context?: Record<string, unknown>;
        }

        const logEntry: LogEntry = {
            ts: new Date(logEvent.startTime).toISOString(),
            level: logEvent.level.levelStr,
            category: logEvent.categoryName,
            msg: message,
        };

        if (extra && typeof extra === "object" && !Array.isArray(extra)) {
            logEntry.context = extra as Record<string, unknown>;
        }

        return stringify(logEntry) + "\n";
    };
}
