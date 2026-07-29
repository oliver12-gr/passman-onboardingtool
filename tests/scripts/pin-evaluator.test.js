import { describe, it, expect } from 'vitest';
import { evaluatePin } from '../../src/scripts/pin-evaluator.js';

describe('evaluatePin', () => {
  it('identifies a 4-digit PIN', () => {
    const r = evaluatePin('1234');
    expect(r.isPin).toBe(true);
    expect(r.length).toBe(4);
    // 4 * log2(10) ≈ 13.29
    expect(r.entropyBits).toBeCloseTo(13.29, 1);
  });

  it('identifies a 6-digit PIN', () => {
    const r = evaluatePin('000000');
    expect(r.isPin).toBe(true);
    expect(r.entropyBits).toBeCloseTo(19.93, 1);
  });

  it('rejects non-numeric input as not a PIN', () => {
    const r = evaluatePin('abc123');
    expect(r.isPin).toBe(false);
    expect(r.entropyBits).toBe(0);
  });

  it('rejects PINs longer than 8 digits', () => {
    const r = evaluatePin('123456789');
    expect(r.isPin).toBe(false);
  });

  it('handles empty input', () => {
    const r = evaluatePin('');
    expect(r.isPin).toBe(false);
    expect(r.entropyBits).toBe(0);
  });
});
