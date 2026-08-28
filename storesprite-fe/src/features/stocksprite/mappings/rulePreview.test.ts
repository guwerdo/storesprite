import { describe, it, expect } from 'vitest';
import type { IMappingRule } from '../../../types/Mapping.interface.js';
import { computePreview } from './rulePreview.js';

describe('computePreview', () => {
  it('applies an ordered numeric pipeline', () => {
    const rules: IMappingRule[] = [
      { op: 'multiply', params: { value: 3 } },
      { op: 'subtract', params: { value: 1 } },
    ];
    expect(computePreview(rules, 4)).toEqual(['4', '12', '11']);
  });

  it('averages an interval into a single number', () => {
    const rules: IMappingRule[] = [{ op: 'average', params: { separator: '-' } }];
    expect(computePreview(rules, '34-66')).toEqual(['34-66', '50']);
  });

  it('replaces all occurrences for a sku pipeline', () => {
    const rules: IMappingRule[] = [{ op: 'replace-all', params: { from: ' ', to: '_' } }];
    expect(computePreview(rules, 'part no')).toEqual(['part no', 'part_no']);
  });

  it('returns only the sample when there are no rules', () => {
    expect(computePreview([], 10)).toEqual(['10']);
  });
});
