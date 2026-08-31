import type { IMappingRule } from '../../../types/stocksprite/Mapping.interface.js';

/**
 * Applies a single rule to a value for the inline preview. This is a pure,
 * best-effort client-side mirror of the worker's jsonlogic evaluation — it is
 * never persisted and is only used to show the user what a pipeline would do.
 */
export function applyRuleForPreview(value: string | number, rule: IMappingRule): string | number {
  const params = rule.params ?? {};
  switch (rule.op) {
    case 'multiply':
      return Number(value) * Number(params.value ?? 0);
    case 'divide':
      return Number(value) / Number(params.value ?? 1);
    case 'add':
      return Number(value) + Number(params.value ?? 0);
    case 'subtract':
      return Number(value) - Number(params.value ?? 0);
    case 'round': {
      const decimals = Number(params.decimals ?? 0);
      const factor = Math.pow(10, decimals);
      return Math.round(Number(value) * factor) / factor;
    }
    case 'absolute':
      return Math.abs(Number(value));
    case 'average': {
      const separator = String(params.separator ?? '-');
      const nums = String(value)
        .split(separator)
        .map((part) => Number(part.replace(/[^0-9.-]/g, '')))
        .filter((n) => !Number.isNaN(n));
      if (nums.length === 0) return 0;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    case 'replace-all': {
      const from = String(params.from ?? '');
      const to = String(params.to ?? '');
      return String(value).split(from).join(to);
    }
    default:
      return value;
  }
}

/** Returns the ordered chain of values: `[sample, ...intermediates, result]`. */
export function computePreview(rules: IMappingRule[], sample: string | number): string[] {
  const steps: string[] = [String(sample)];
  let current: string | number = sample;
  for (const rule of rules) {
    current = applyRuleForPreview(current, rule);
    steps.push(String(current));
  }
  return steps;
}
