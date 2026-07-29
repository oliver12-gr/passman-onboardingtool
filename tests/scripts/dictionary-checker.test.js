import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkDictionary,
  __setDictionaryForTests,
} from '../../src/scripts/dictionary-checker.js';

const DICT = new Set(['password', '123456', 'qwerty', 'letmein']);

describe('checkDictionary', () => {
  beforeEach(() => {
    __setDictionaryForTests(DICT);
  });

  it('flags a known password case-insensitively', async () => {
    const r = await checkDictionary('PASSWORD');
    expect(r.inDictionary).toBe(true);
    expect(r.loaded).toBe(true);
  });

  it('returns false for an unknown password', async () => {
    const r = await checkDictionary('x9$Kp2!mQ');
    expect(r.inDictionary).toBe(false);
    expect(r.loaded).toBe(true);
  });

  it('returns loaded=false for empty input', async () => {
    const r = await checkDictionary('');
    expect(r.inDictionary).toBe(false);
    expect(r.loaded).toBe(false);
  });

  it('gracefully handles a missing dictionary', async () => {
    __setDictionaryForTests(null);
    const r = await checkDictionary('anything');
    expect(r.loaded).toBe(false);
    expect(r.inDictionary).toBe(false);
  });
});
