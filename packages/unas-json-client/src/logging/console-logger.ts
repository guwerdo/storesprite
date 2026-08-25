import { injectable } from "inversify";
import type { ILogger } from "../core/logger.interface.js";

@injectable()
export class ConsoleLogger implements ILogger {
    public info(message: string, meta?: unknown): void {
        console.info(message, meta ?? "");
    }

    public warn(message: string, meta?: unknown): void {
        console.warn(message, meta ?? "");
    }

    public error(message: string, meta?: unknown): void {
        console.error(message, meta ?? "");
    }

    public debug(message: string, meta?: unknown): void {
        console.debug(message, meta ?? "");
    }
}
