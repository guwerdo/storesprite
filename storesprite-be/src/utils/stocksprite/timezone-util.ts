import { DEFAULT_TIMEZONE } from "../../config/timezone.constants.js";

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  date: string; // "YYYY-MM-DD"
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = getFormatter(timezone).formatToParts(date);
  } catch {
    parts = getFormatter(DEFAULT_TIMEZONE).formatToParts(date);
  }

  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour) % 24;
  const dayOfWeek = WEEKDAY_INDEX[map.weekday] ?? 0;

  return {
    year,
    month,
    day,
    hour,
    dayOfWeek,
    date: `${map.year}-${map.month}-${map.day}`,
  };
}
