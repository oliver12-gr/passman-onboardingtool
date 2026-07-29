import { describe, it, expect } from 'vitest';
import { calculateEntropy } from '../../src/scripts/entropy-calculator.js';

describe('calculateEntropy', () => {
  it('returns zero for empty input', () => {
    expect(calculateEntropy('')).toEqual({
      entropyBits: 0,
      characterClasses: [],
      poolSize: 0,
    });
  });

  it('returns zero for non-string input', () => {
    expect(calculateEntropy(null).entropyBits).toBe(0);
  });

  it('treats lowercase-only as 26-symbol pool', () => {
    const r = calculateEntropy('abc');
    expect(r.characterClasses).toEqual(['lowercase']);
    expect(r.poolSize).toBe(26);
    // 3 * log2(26) ≈ 14.1
    expect(r.entropyBits).toBeCloseTo(14.1, 1);
  });

  it('combines multiple character classes', () => {
    const r = calculateEntropy('aB3!');
    expect(r.characterClasses).toEqual([
      'lowercase',
      'uppercase',
      'digits',
      'symbols',
    ]);
    expect(r.poolSize).toBe(95);
  });

  it('increases entropy with length', () => {
    const short = calculateEntropy('abc');
    const long = calculateEntropy('abcdefgh');
    expect(long.entropyBits).toBeGreaterThan(short.entropyBits);
  });
});
