import { vi } from "vitest";
import type { Logger } from "log4js";

/** Shared no-op logger for unit tests. Pass field overrides to assert on a specific method. */
export function stubLogger(overrides: Partial<Logger> = {}): Logger {
    return {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        mark: vi.fn(),
        ...overrides,
    } as unknown as Logger;
}
