import type { IMapping } from '../../../types/Mapping.interface.js';

export type MappingStatus = 'active' | 'inactive';

export function getMappingStatus(mapping: IMapping): MappingStatus {
  return mapping.enabled ? 'active' : 'inactive';
}
