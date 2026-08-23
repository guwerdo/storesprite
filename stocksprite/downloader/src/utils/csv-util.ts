export class CsvUtil {
  /**
   * Splits a CSV row on the given delimiter, honoring double-quoted cells
   * (a delimiter inside quotes is kept) and `""` escapes for literal quotes.
   */
  public static splitCsvRow(row: string, delimiter: string): string[] {
    const cells: string[] = [];
    let insideQuotes = false;
    let currentCell = "";

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        if (insideQuotes && i + 1 < row.length && row[i + 1] === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        cells.push(currentCell);
        currentCell = "";
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell);

    return cells;
  }
}
