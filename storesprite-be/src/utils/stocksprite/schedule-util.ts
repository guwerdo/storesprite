import { MappingSchedule } from "../../types/stocksprite/MappingRepository.interface.js";
import { ZonedParts } from "./timezone-util.js";

export function isScheduleDue(schedule: MappingSchedule, z: ZonedParts): boolean {
  switch (schedule.frequency) {
    case "once":
      return schedule.date === z.date && schedule.time === z.hour;
    case "daily": {
      if (!schedule.times.includes(z.hour)) {
        return false;
      }
      if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
        return schedule.daysOfWeek.includes(z.dayOfWeek);
      }
      return true;
    }
    case "monthly":
      return schedule.dayOfMonth === z.day && schedule.time === z.hour;
    default:
      return false;
  }
}
