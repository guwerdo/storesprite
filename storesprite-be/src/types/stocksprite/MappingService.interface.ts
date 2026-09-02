import {
  MappingDto,
  CreateMappingDto,
  UpdateMappingDto,
} from "./MappingRepository.interface.js";
import { MappingHistoryDto } from "./MappingHistoryRepository.interface.js";

export interface IMappingService {
  getMappings(userId: string): Promise<MappingDto[]>;
  getMappingById(id: string, userId: string): Promise<MappingDto | null>;
  createMapping(userId: string, dto: CreateMappingDto): Promise<MappingDto>;
  updateMapping(id: string, userId: string, dto: UpdateMappingDto): Promise<MappingDto | null>;
  deleteMapping(id: string, userId: string): Promise<boolean>;
  runMapping(id: string, userId: string): Promise<boolean>;
  /** Returns null when the mapping does not belong to the user. */
  listHistory(mappingId: string, userId: string): Promise<MappingHistoryDto[] | null>;
}
