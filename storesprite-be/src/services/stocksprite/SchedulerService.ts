import { injectable, inject } from "inversify";
import type { Logger } from "log4js";
import { Mapping } from "../../entities/stocksprite/Mapping.js";
import { IMappingRepository } from "../../types/stocksprite/MappingRepository.interface.js";
import { ISettingService } from "../../types/user/SettingService.interface.js";
import { ISchedulerService } from "../../types/stocksprite/SchedulerService.interface.js";
import { getZonedParts } from "../../utils/stocksprite/timezone-util.js";
import { isScheduleDue } from "../../utils/stocksprite/schedule-util.js";
import { DEFAULT_TIMEZONE } from "../../config/timezone.constants.js";
import { TYPES } from "../../di/types.js";

@injectable()
export class SchedulerService implements ISchedulerService {
  constructor(
    @inject(TYPES.IMappingRepository)
    private readonly _repository: IMappingRepository,
    @inject(TYPES.ISettingService)
    private readonly _settingService: ISettingService,
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

      this._dispatchMappingRun(mapping.id);

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
   * Dispatch stub. TODO(scheduler → follow-up trigger-driver): replace with the real
   * docker (dev) / Cloud Run job (prod) dispatch. Pass MAPPING_ID, INTERNAL_TOKEN, BACKEND_URL
   * so the stateless container calls back into /api/internal/stocksprite/* to resolve mapping
   * details, userId, and connection config. Do NOT build the container here.
   */
  private _dispatchMappingRun(mappingId: string): void {
    const token = process.env.INTERNAL_TOKEN || "";
    const backendUrl = process.env.INTERNAL_BACKEND_URL || "http://storesprite-be:3000";
    this._logger?.info("Scheduler dispatch stub (container dispatch not yet implemented)", {
      mappingId,
      tokenProvided: token.length > 0,
      backendUrl,
    });
  }
}
