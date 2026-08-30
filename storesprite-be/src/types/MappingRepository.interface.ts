import { Mapping } from "../entities/Mapping.js";

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

export type MappingSchedule =
  | { frequency: "once"; date: string; time: number }
  | { frequency: "daily"; times: number[]; daysOfWeek?: number[] }
  | { frequency: "monthly"; dayOfMonth: number; time: number };

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
  create(userId: string, data: CreateMappingDto): Promise<Mapping>;
  update(id: string, userId: string, data: UpdateMappingDto): Promise<Mapping | null>;
  delete(id: string, userId: string): Promise<boolean>;
}
