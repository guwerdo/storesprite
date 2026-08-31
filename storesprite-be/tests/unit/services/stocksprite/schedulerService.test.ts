import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { SchedulerService } from "../../../../src/services/stocksprite/SchedulerService.js";
import { IMappingRepository } from "../../../../src/types/stocksprite/MappingRepository.interface.js";
import { ISettingService } from "../../../../src/types/user/SettingService.interface.js";
import { Mapping } from "../../../../src/entities/stocksprite/Mapping.js";
import { DataConnection } from "../../../../src/entities/stocksprite/DataConnection.js";
import { User } from "../../../../src/entities/user/User.js";

describe("SchedulerService", () => {
  let repoMock: ReturnType<typeof mock<IMappingRepository>>;
  let settingMock: ReturnType<typeof mock<ISettingService>>;
  let service: SchedulerService;

  const user = new User("u1", "u1@t.com", "U");
  const conn = new DataConnection(
    user,
    "Feed",
    "HTTP",
    "CSV",
    { channel: "HTTP", url: "https://x" },
    { format: "CSV", delimiter: ";" },
    true,
    null,
    { success: true, columns: ["sku"] }
  );

  const makeMapping = (schedule: unknown, lastRunAt?: Date): Mapping => {
    const m = new Mapping(user, conn, "M", "sku", []);
    m.id = "m1";
    m.scheduleEnabled = true;
    m.schedule = schedule as Mapping["schedule"];
    if (lastRunAt) {
      m.lastRunAt = lastRunAt;
    }
    return m;
  };

  beforeEach(() => {
    repoMock = mock<IMappingRepository>();
    settingMock = mock<ISettingService>();
    service = new SchedulerService(repoMock, settingMock);
  });

  it("dispatches a due daily schedule", async () => {
    const now = new Date("2026-07-15T09:30:00Z"); // 11:00 Budapest, Wed(3)
    repoMock.getEnabledSchedules.mockResolvedValue([makeMapping({ frequency: "daily", times: [11], daysOfWeek: [3] })]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);

    const r = await service.runDue(now);

    expect(r.dispatched).toEqual(["m1"]);
    expect(repoMock.markLastRun).toHaveBeenCalledWith("m1", "u1", now);
  });

  it("skips a not-due schedule", async () => {
    const now = new Date("2026-07-15T09:30:00Z");
    repoMock.getEnabledSchedules.mockResolvedValue([makeMapping({ frequency: "daily", times: [9] })]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);

    expect((await service.runDue(now)).dispatched).toEqual([]);
    expect(repoMock.markLastRun).not.toHaveBeenCalled();
  });

  it("skips an already-fired schedule this hour (idempotency)", async () => {
    const now = new Date("2026-07-15T09:30:00Z");
    const alreadyFired = new Date("2026-07-15T09:05:00Z"); // same hour (11:00 Budapest)
    repoMock.getEnabledSchedules.mockResolvedValue([makeMapping({ frequency: "daily", times: [11] }, alreadyFired)]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);

    expect((await service.runDue(now)).dispatched).toEqual([]);
  });

  it("disables a one-time schedule after firing", async () => {
    const now = new Date("2026-07-15T09:30:00Z");
    repoMock.getEnabledSchedules.mockResolvedValue([makeMapping({ frequency: "once", date: "2026-07-15", time: 11 })]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);

    await service.runDue(now);

    expect(repoMock.update).toHaveBeenCalledWith("m1", "u1", { scheduleEnabled: false });
  });
});
