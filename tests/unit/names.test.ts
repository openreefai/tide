import { describe, it, expect } from 'vitest';
import { canonicalizeName, validateName, checkNearDuplicate } from '@/lib/names';

describe('canonicalizeName', () => {
  it('trims and lowercases', () => {
    expect(canonicalizeName('  Daily-Ops  ')).toBe('daily-ops');
  });
});

describe('validateName', () => {
  it('accepts valid names', () => {
    expect(validateName('daily-ops').valid).toBe(true);
    expect(validateName('a').valid).toBe(true);
    expect(validateName('my-cool-formation-123').valid).toBe(true);
  });

  it('rejects names with invalid chars', () => {
    expect(validateName('Daily_Ops').valid).toBe(false);
    expect(validateName('my formation').valid).toBe(false);
    expect(validateName('my.formation').valid).toBe(false);
  });

  it('rejects names over 128 chars', () => {
    expect(validateName('a'.repeat(129)).valid).toBe(false);
  });

  it('rejects empty names', () => {
    expect(validateName('').valid).toBe(false);
  });

  it('rejects names starting or ending with hyphen', () => {
    expect(validateName('-foo').valid).toBe(false);
    expect(validateName('foo-').valid).toBe(false);
  });
});

describe('checkNearDuplicate', () => {
  it('normalizes underscores and dots to hyphens', () => {
    expect(checkNearDuplicate('daily_ops')).toBe('daily-ops');
    expect(checkNearDuplicate('daily.ops')).toBe('daily-ops');
  });
});
