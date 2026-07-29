import { describe, it, expect } from 'vitest';
import { estimateTimeToCrack } from '../../src/scripts/time-to-crack.js';

describe('estimateTimeToCrack', () => {
  it('returns "instantly" for zero entropy', () => {
    expect(estimateTimeToCrack(0).label).toBe('instantly');
  });

  it('returns "instantly" for negative entropy', () => {
    expect(estimateTimeToCrack(-5).label).toBe('instantly');
  });

  it('returns seconds for very low entropy', () => {
    // 10 bits → 2^10 / 1e10 = 0.0001 seconds → instantly
    expect(estimateTimeToCrack(10).label).toBe('instantly');
  });

  it('returns seconds for low entropy', () => {
    // 36 bits → 2^36 / 1e10 ≈ 6.87 seconds
    expect(estimateTimeToCrack(36).label).toMatch(/seconds/);
  });

  it('returns minutes for moderate entropy', () => {
    // 42 bits → 2^42 / 1e10 ≈ 440 seconds → ~7 minutes
    expect(estimateTimeToCrack(42).label).toMatch(/minutes/);
  });

  it('returns years for high entropy', () => {
    // 80 bits → 2^80 / 1e10 ≈ 1.2e14 seconds → ~3.8 million years
    expect(estimateTimeToCrack(80).label).toMatch(/million years/);
  });

  it('returns trillion years for very high entropy', () => {
    // 120 bits → 2^120 / 1e10 ≈ 1.33e26 seconds → ~4.2e18 years
    expect(estimateTimeToCrack(120).label).toMatch(/trillion years/);
  });
});
