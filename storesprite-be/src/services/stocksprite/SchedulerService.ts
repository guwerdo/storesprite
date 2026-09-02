import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { Mapping } from "../../entities/stocksprite/Mapping.js";
import { IMappingRepository } from "../../types/stocksprite/MappingRepository.interface.js";
import { IMappingHistoryRepository } from "../../types/stocksprite/MappingHistoryRepository.interface.js";
import { IConnectionTestRunnerService } from "../../types/stocksprite/ConnectionTestRunnerService.interface.js";
import { ISettingService } from "../../types/user/SettingService.interface.js";
import { ISchedulerService } from "../../types/stocksprite/SchedulerService.interface.js";
import { getZonedParts } from "../../utils/stocksprite/timezone-util.js";
import { isScheduleDue } from "../../utils/stocksprite/schedule-util.js";
import { DEFAULT_TIMEZONE } from "../../config/timezone.constants.js";
import { HISTORY_RETENTION } from "../../config/stocksprite/history.constants.js";
import { TYPES } from "../../di/types.js";

@injectable()
export class SchedulerService implements ISchedulerService {
  constructor(
    @inject(TYPES.IMappingRepository)
    private readonly _repository: IMappingRepository,
    @inject(TYPES.ISettingService)
    private readonly _settingService: ISettingService,
    @inject(TYPES.IMappingHistoryRepository)
    private readonly _historyRepository: IMappingHistoryRepository,
    @inject(TYPES.IConnectionTestRunnerService)
    private readonly _runner: IConnectionTestRunnerService,
    @inject(TYPES.Logger)
    private readonly _logger?: Logger
  ) {}

  public async runDue(now: Date): Promise<{ dispatched: string[] }> {
    const enabled = await this._repository.getEnabledSchedules();
    const dispatched: string[] = [];

    for (const mapping of enabled) {
      if (!mapping.schedule) {
        continue;
      }

      const timezone = await this._resolveTimezone(mapping);
      const z = getZonedParts(now, timezone);
      if (!isScheduleDue(mapping.schedule, z)) {
        continue;
      }

      const userId = mapping.user?.id;
      if (!userId) {
        continue;
      }

      // Idempotency: skip if already fired within this hour (user's tz)
      if (mapping.lastRunAt) {
        const lastZ = getZonedParts(mapping.lastRunAt, timezone);
        if (lastZ.date === z.date && lastZ.hour === z.hour) {
          continue;
        }
      }

      await this._dispatchMappingRun(mapping, userId);

      if (mapping.schedule.frequency === "once") {
        await this._repository.update(mapping.id, userId, { scheduleEnabled: false });
        this._logger?.info("Disabled one-time schedule after run", { mappingId: mapping.id });
      }

      await this._repository.markLastRun(mapping.id, userId, now);
      dispatched.push(mapping.id);
    }

    return { dispatched };
  }

  private async _resolveTimezone(mapping: Mapping): Promise<string> {
    const userId = mapping.user?.id;
    if (!userId) {
      return DEFAULT_TIMEZONE;
    }
    const settings = await this._settingService.getUserSettings(userId);
    return settings?.timezone || DEFAULT_TIMEZONE;
  }

  /**
   * Opens a run-history row for the mapping and fire-and-forget dispatches the combined
   * container. Any previous run still marked `running` is superseded first, then the new
   * `running` row is created and the oldest non-running rows are pruned to the retention cap.
   * The container is spawned detached (`docker run -d`) and reports back via the internal
   * progress endpoint, so this method never waits for the run to finish.
   */
  private async _dispatchMappingRun(mapping: Mapping, userId: string): Promise<void> {
    await this._historyRepository.markRunningAsFailed(mapping.id, "superseded");

    const run = await this._historyRepository.create(mapping, "running", "schedule");

    await this._historyRepository.prune(mapping.id, HISTORY_RETENTION);

    const token = process.env.INTERNAL_TOKEN || "";
    const backendUrl = process.env.INTERNAL_BACKEND_URL || "http://storesprite-be:3000";
    this._logger?.info("Scheduler dispatching mapping run container", {
      mappingId: mapping.id,
      runId: run.id,
      tokenProvided: token.length > 0,
      backendUrl,
    });

    void this._runner.runMapping(mapping.id, run.id, userId, token, backendUrl);
  }
}
