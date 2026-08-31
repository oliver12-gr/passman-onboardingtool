import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateStrength, VERDICTS } from '../../src/scripts/strength-evaluator.js';
import { __setDictionaryForTests } from '../../src/scripts/dictionary-checker.js';

const DICT = new Set(['password', '123456', 'qwerty']);

describe('evaluateStrength', () => {
  beforeEach(() => {
    __setDictionaryForTests(DICT);
  });

  it('returns a null verdict for empty input', async () => {
    const r = await evaluateStrength('');
    expect(r.verdict).toBeNull();
  });

  it('flags a dictionary word as Very Weak regardless of length', async () => {
    const r = await evaluateStrength('password');
    expect(r.inDictionary).toBe(true);
    expect(r.verdict).toBe(VERDICTS.VERY_WEAK);
    expect(r.suggestion).toContain('dictionary');
  });

  it('caps a 4-digit PIN at Weak', async () => {
    const r = await evaluateStrength('7291');
    expect(r.isPin).toBe(true);
    expect(r.verdict).toBe(VERDICTS.WEAK);
  });

  it('rates a long random passphrase as Strong or better', async () => {
    const r = await evaluateStrength('correct-horse-battery-staple-9!');
    expect(r.entropyBits).toBeGreaterThan(60);
    expect([
      VERDICTS.STRONG,
      VERDICTS.VERY_STRONG,
    ]).toContain(r.verdict);
  });

  it('rates a short lowercase word as Very Weak', async () => {
    const r = await evaluateStrength('cat');
    expect(r.verdict).toBe(VERDICTS.VERY_WEAK);
  });
});
