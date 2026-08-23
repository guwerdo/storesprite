export class EncodingUtil {
  public static normalizeEncoding(encoding?: string): string {
    if (!encoding) return "utf-8";
    const lower = encoding.trim().toLowerCase();
    if (lower === "utf-8-bom" || lower === "utf8-bom" || lower === "utf-8 with bom") {
      return "utf-8";
    }
    return lower;
  }
}
