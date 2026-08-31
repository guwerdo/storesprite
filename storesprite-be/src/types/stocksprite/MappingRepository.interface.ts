import { Mapping } from "../../entities/stocksprite/Mapping.js";

export interface MappingRule {
  op: string;
  params: Record<string, string | number>;
}

export interface StockMappingItem {
  /**
   * @minLength 1
   */
  column: string;
  /**
   * @minimum 1
   */
  warehouseId: number;
  rules?: MappingRule[];
}

export type StockMappingItems = StockMappingItem[];
export type MappingRules = MappingRule[];

/** @asType integer @minimum 0 @maximum 23 */
export type ScheduleHour = number;

/** @asType integer @minimum 0 @maximum 6 */
export type ScheduleDayOfWeek = number;

/** @asType integer @minimum 1 @maximum 31 */
export type ScheduleDayOfMonth = number;

export type MappingSchedule =
  | {
      frequency: "once";
      /**
       * @format date
       */
      date: string;
      time: ScheduleHour;
    }
  | {
      frequency: "daily";
      /**
       * @minItems 1
       * @uniqueItems true
       */
      times: ScheduleHour[];
      /**
       * @uniqueItems true
       */
      daysOfWeek?: ScheduleDayOfWeek[];
    }
  | {
      frequency: "monthly";
      dayOfMonth: ScheduleDayOfMonth;
      time: ScheduleHour;
    };

export interface MappingDto {
  id: string;
  userId?: string;
  name: string;
  scheduleEnabled: boolean;
  schedule?: MappingSchedule | null;
  connectionId: string;
  skuField: string;
  skuRules?: MappingRule[] | null;
  stockMappings: StockMappingItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMappingDto {
  name: string;
  connectionId: string;
  skuField: string;
  skuRules?: MappingRule[] | null;
  stockMappings: StockMappingItem[];
}

export interface UpdateMappingDto {
  name?: string;
  connectionId?: string;
  skuField?: string;
  skuRules?: MappingRule[] | null;
  stockMappings?: StockMappingItem[];
  scheduleEnabled?: boolean;
  schedule?: MappingSchedule | null;
}

export interface IMappingRepository {
  getAllByUserId(userId: string): Promise<Mapping[]>;
  getByIdAndUserId(id: string, userId: string): Promise<Mapping | null>;
  getByConnectionIdAndUserId(connectionId: string, userId: string): Promise<Mapping | null>;
  getEnabledSchedules(): Promise<Mapping[]>;
  create(userId: string, data: CreateMappingDto): Promise<Mapping>;
  update(id: string, userId: string, data: UpdateMappingDto): Promise<Mapping | null>;
  delete(id: string, userId: string): Promise<boolean>;
  markLastRun(id: string, userId: string, date: Date): Promise<void>;
}
