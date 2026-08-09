import { describe, it, expect } from 'vitest';
import { Util } from '../utils/index.js';

describe('Frontend Util Module', () => {
  describe('formatDate', () => {
    it('should format valid date string', () => {
      const formatted = Util.formatDate('2026-08-17T12:00:00Z');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('stringifyError', () => {
    it('should extract error message from Error instance', () => {
      const error = new Error('Frontend error');
      expect(Util.stringifyError(error)).toBe('Frontend error');
    });

    it('should return string as is', () => {
      expect(Util.stringifyError('simple error')).toBe('simple error');
    });

    it('should JSON stringify object errors', () => {
      expect(Util.stringifyError({ message: 'failed' })).toBe('{"message":"failed"}');
    });
  });
});
