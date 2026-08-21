export class ErrorUtil {
  public static stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack || error.message;
    }
    if (typeof error === "object" && error !== null) {
      try {
        return JSON.stringify(error);
      } catch {
        return Object.prototype.toString.call(error);
      }
    }
    return typeof error === "string" ? error : JSON.stringify(error);
  }
}
