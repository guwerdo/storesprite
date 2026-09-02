import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { mock } from "vitest-mock-extended";
import { SchedulerService } from "../../../../src/services/stocksprite/SchedulerService.js";
import { IMappingRepository } from "../../../../src/types/stocksprite/MappingRepository.interface.js";
import { IMappingHistoryRepository } from "../../../../src/types/stocksprite/MappingHistoryRepository.interface.js";
import { IConnectionTestRunnerService } from "../../../../src/types/stocksprite/ConnectionTestRunnerService.interface.js";
import { ISettingService } from "../../../../src/types/user/SettingService.interface.js";
import { Mapping } from "../../../../src/entities/stocksprite/Mapping.js";
import { MappingHistory } from "../../../../src/entities/stocksprite/MappingHistory.js";
import { DataConnection } from "../../../../src/entities/stocksprite/DataConnection.js";
import { User } from "../../../../src/entities/user/User.js";
import { HISTORY_RETENTION } from "../../../../src/config/stocksprite/history.constants.js";

describe("SchedulerService", () => {
  let repoMock: ReturnType<typeof mock<IMappingRepository>>;
  let settingMock: ReturnType<typeof mock<ISettingService>>;
  let historyMock: ReturnType<typeof mock<IMappingHistoryRepository>>;
  let runnerMock: ReturnType<typeof mock<IConnectionTestRunnerService>>;
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
    historyMock = mock<IMappingHistoryRepository>();
    runnerMock = mock<IConnectionTestRunnerService>();
    service = new SchedulerService(repoMock, settingMock, historyMock, runnerMock);
  });

  const makeRun = (mapping: Mapping): MappingHistory => {
    const run = new MappingHistory(mapping, "running", "schedule");
    run.id = "run1";
    return run;
  };

  it("dispatches a due mapping: supersedes, opens a run, prunes, spawns the runner", async () => {
    const now = new Date("2026-07-15T09:30:00Z"); // 11:00 Budapest, Wed(3)
    const mapping = makeMapping({ frequency: "daily", times: [11], daysOfWeek: [3] });
    repoMock.getEnabledSchedules.mockResolvedValue([mapping]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);
    historyMock.create.mockResolvedValue(makeRun(mapping));
    delete process.env.INTERNAL_TOKEN;
    delete process.env.INTERNAL_BACKEND_URL;

    const r = await service.runDue(now);

    expect(r.dispatched).toEqual(["m1"]);
    expect(repoMock.markLastRun).toHaveBeenCalledWith("m1", "u1", now);

    // History lifecycle
    expect(historyMock.markRunningAsFailed).toHaveBeenCalledWith("m1", "superseded");
    expect(historyMock.create).toHaveBeenCalledWith(mapping, "running", "schedule");
    expect(historyMock.prune).toHaveBeenCalledWith("m1", HISTORY_RETENTION);

    // Runner dispatch is fire-and-forget
    expect(runnerMock.runMapping).toHaveBeenCalledTimes(1);
    const [, runId, userId, token, backendUrl] = runnerMock.runMapping.mock.calls[0];
    expect(runId).toBe("run1");
    expect(userId).toBe("u1");
    expect(token).toBe("");
    expect(backendUrl).toBe("http://storesprite-be:3000");
  });

  it("passes the configured internal token and backend URL to the runner", async () => {
    const now = new Date("2026-07-15T09:30:00Z");
    const mapping = makeMapping({ frequency: "daily", times: [11], daysOfWeek: [3] });
    repoMock.getEnabledSchedules.mockResolvedValue([mapping]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);
    historyMock.create.mockResolvedValue(makeRun(mapping));
    const originalToken = process.env.INTERNAL_TOKEN;
    const originalUrl = process.env.INTERNAL_BACKEND_URL;
    process.env.INTERNAL_TOKEN = "secret-token";
    process.env.INTERNAL_BACKEND_URL = "http://be:3000";

    await service.runDue(now);

    expect(runnerMock.runMapping).toHaveBeenCalledWith("m1", "run1", "u1", "secret-token", "http://be:3000");

    if (originalToken === undefined) delete process.env.INTERNAL_TOKEN;
    else process.env.INTERNAL_TOKEN = originalToken;
    if (originalUrl === undefined) delete process.env.INTERNAL_BACKEND_URL;
    else process.env.INTERNAL_BACKEND_URL = originalUrl;
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
    const mapping = makeMapping({ frequency: "once", date: "2026-07-15", time: 11 });
    repoMock.getEnabledSchedules.mockResolvedValue([mapping]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);
    historyMock.create.mockResolvedValue(makeRun(mapping));

    await service.runDue(now);

    expect(repoMock.update).toHaveBeenCalledWith("m1", "u1", { scheduleEnabled: false });
  });

  it("marks the prior running run as superseded before opening a new one", async () => {
    const now = new Date("2026-07-15T09:30:00Z");
    const mapping = makeMapping({ frequency: "daily", times: [11], daysOfWeek: [3] });
    repoMock.getEnabledSchedules.mockResolvedValue([mapping]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);
    historyMock.create.mockResolvedValue(makeRun(mapping));

    await service.runDue(now);

    expect(historyMock.markRunningAsFailed).toHaveBeenCalledTimes(1);
  });

  it("does not open a history row or spawn the runner for a not-due mapping", async () => {
    const now = new Date("2026-07-15T09:30:00Z");
    repoMock.getEnabledSchedules.mockResolvedValue([makeMapping({ frequency: "daily", times: [9] })]);
    settingMock.getUserSettings.mockResolvedValue({ timezone: "Europe/Budapest" } as never);

    await service.runDue(now);

    expect(historyMock.create).not.toHaveBeenCalled();
    expect(runnerMock.runMapping).not.toHaveBeenCalled();
  });
});
