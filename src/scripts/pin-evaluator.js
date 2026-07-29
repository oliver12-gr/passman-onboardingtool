/**
 * PIN entropy evaluator.
 *
 * Short numeric-only inputs are not really "passwords" — they are PINs.
 * Their search space is 10^n, not the full character-class pool, so a
 * 6-digit numeric code is correctly identified as ~19.93 bits rather than
 * being inflated by the digit-class pool size.
 *
 * @param {string} input - The candidate password.
 * @returns {{isPin: boolean, entropyBits: number, length: number}}
 */
export function evaluatePin(input) {
  if (!input || typeof input !== 'string') {
    return { isPin: false, entropyBits: 0, length: 0 };
  }

  const isNumericOnly = /^[0-9]+$/.test(input);
  const isPin = isNumericOnly && input.length > 0 && input.length <= 8;

  if (!isPin) {
    return { isPin: false, entropyBits: 0, length: input.length };
  }

  const entropyBits =
    Math.round(input.length * Math.log2(10) * 100) / 100;

  return { isPin: true, entropyBits, length: input.length };
}
