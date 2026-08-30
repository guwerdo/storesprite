import { describe, it, expect } from 'vitest';
import type { IMapping, IMappingRuleDefinition } from '../../../../types/Mapping.interface.js';
import { MappingFormValues } from './mappingFormSchema.js';
import { toApiPayload, toFormValues } from './mappingFormTransformers.js';

const rulesDict: IMappingRuleDefinition[] = [
  { op: 'multiply', groups: ['stock'], params: [{ name: 'value', type: 'number' }] },
  { op: 'replace-all', groups: ['sku', 'stock'], params: [{ name: 'from', type: 'string' }, { name: 'to', type: 'string' }] },
];

const makeForm = (overrides: Partial<MappingFormValues> = {}): MappingFormValues => ({
  name: 'Cromwell',
  connectionId: 'c1',
  skuField: 'part',
  skuRules: [],
  stockMappings: [],
  ...overrides,
});

describe('mappingFormTransformers', () => {
  it('converts a mapping to form values (params -> strings)', () => {
    const mapping: IMapping = {
      id: '1',
      name: 'Cromwell',
      scheduleEnabled: false,
      connectionId: 'c1',
      skuField: 'part',
      skuRules: [{ op: 'replace-all', params: { from: ' ', to: '_' } }],
      stockMappings: [{ column: 'stock', warehouseId: 1, rules: [{ op: 'multiply', params: { value: 3 } }] }],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const form = toFormValues(mapping);

    expect(form.connectionId).toBe('c1');
    expect(form.skuField).toBe('part');
    expect(form.skuRules[0].params.from).toBe(' ');
    expect(form.stockMappings[0].warehouseId).toBe('1');
    expect(form.stockMappings[0].rules[0].params.value).toBe('3');
  });

  it('converts form values to an API payload (number params become numbers)', () => {
    const form = makeForm({
      skuRules: [{ op: 'replace-all', params: { from: ' ', to: '_' } }],
      stockMappings: [{ column: 'stock', warehouseId: '1', rules: [{ op: 'multiply', params: { value: '3' } }] }],
    });

    const payload = toApiPayload(form, rulesDict);

    expect(payload.stockMappings[0].warehouseId).toBe(1);
    expect(payload.stockMappings[0].rules?.[0]?.params.value).toBe(3);
    expect(payload.skuRules?.[0]?.params.from).toBe(' ');
  });

  it('drops empty rules', () => {
    const form = makeForm({ skuRules: [{ op: '', params: {} }] });

    const payload = toApiPayload(form, rulesDict);

    expect(payload.skuRules).toEqual([]);
  });
});
