export function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Single-line, size-capped error text for surfacing to a UI or persisting on a record.
 * Unlike {@link stringifyError}, Errors are reduced to their `message` (no stack trace).
 */
export function describeError(error: unknown, maxLength = 2000): string {
  const text = error instanceof Error ? error.message : stringifyError(error);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}… (truncated)`;
}
