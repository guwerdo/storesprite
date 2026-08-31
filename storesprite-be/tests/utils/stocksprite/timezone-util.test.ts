import { describe, it, expect } from "vitest";
import { getZonedParts } from "../../../src/utils/stocksprite/timezone-util.js";

describe("getZonedParts", () => {
  it("Europe/Budapest winter (UTC+1)", () => {
    expect(getZonedParts(new Date("2026-01-15T09:30:00Z"), "Europe/Budapest"))
      .toEqual({ year: 2026, month: 1, day: 15, hour: 10, dayOfWeek: 4, date: "2026-01-15" });
  });

  it("Europe/Budapest summer (UTC+2)", () => {
    expect(getZonedParts(new Date("2026-07-15T09:30:00Z"), "Europe/Budapest"))
      .toEqual({ year: 2026, month: 7, day: 15, hour: 11, dayOfWeek: 3, date: "2026-07-15" });
  });

  it("midnight rolls to hour 0 next day", () => {
    const z = getZonedParts(new Date("2026-01-15T23:30:00Z"), "Europe/Budapest");
    expect(z.hour).toBe(0);
    expect(z.date).toBe("2026-01-16");
  });

  it("invalid timezone falls back to default", () => {
    expect(getZonedParts(new Date("2026-07-15T09:30:00Z"), "Not/AZone").hour).toBe(11);
  });
});
