import diff from "microdiff";

/**
 * Deeply compares two values for structural equality using microdiff.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  if (typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  return diff(a as Record<string, unknown>, b as Record<string, unknown>).length === 0;
}
