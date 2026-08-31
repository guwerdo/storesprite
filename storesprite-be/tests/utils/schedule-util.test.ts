import { describe, it, expect } from "vitest";
import { isScheduleDue } from "../../src/utils/stocksprite/schedule-util.js";

const z = { year: 2026, month: 7, day: 15, hour: 11, dayOfWeek: 3, date: "2026-07-15" };

describe("isScheduleDue", () => {
  it("once", () => {
    expect(isScheduleDue({ frequency: "once", date: "2026-07-15", time: 11 }, z)).toBe(true);
    expect(isScheduleDue({ frequency: "once", date: "2026-07-16", time: 11 }, z)).toBe(false);
  });

  it("daily every day", () => {
    expect(isScheduleDue({ frequency: "daily", times: [11] }, z)).toBe(true);
    expect(isScheduleDue({ frequency: "daily", times: [9] }, z)).toBe(false);
  });

  it("daily daysOfWeek", () => {
    expect(isScheduleDue({ frequency: "daily", times: [11], daysOfWeek: [1, 3, 5] }, z)).toBe(true);
    expect(isScheduleDue({ frequency: "daily", times: [11], daysOfWeek: [1, 2, 4] }, z)).toBe(false);
  });

  it("daily empty daysOfWeek = every day", () => {
    expect(isScheduleDue({ frequency: "daily", times: [11], daysOfWeek: [] }, z)).toBe(true);
  });

  it("monthly", () => {
    expect(isScheduleDue({ frequency: "monthly", dayOfMonth: 15, time: 11 }, z)).toBe(true);
    expect(isScheduleDue({ frequency: "monthly", dayOfMonth: 16, time: 11 }, z)).toBe(false);
  });
});
