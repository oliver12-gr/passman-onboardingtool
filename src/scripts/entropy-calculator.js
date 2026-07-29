/**
 * Shannon-style entropy estimator for a candidate password.
 *
 * Estimates the search space as the product of the size of every character
 * class present in the input, then returns entropy in bits as
 * log2(space) * length. This is a conservative upper bound on the cost of
 * an exhaustive search given the observed character classes.
 *
 * @param {string} input - The candidate password. Not stored or logged.
 * @returns {{entropyBits: number, characterClasses: string[], poolSize: number}}
 */
export function calculateEntropy(input) {
  if (!input || typeof input !== 'string') {
    return { entropyBits: 0, characterClasses: [], poolSize: 0 };
  }

  const classes = {
    lowercase: /[a-z]/.test(input),
    uppercase: /[A-Z]/.test(input),
    digits: /[0-9]/.test(input),
    symbols: /[^a-zA-Z0-9]/.test(input),
  };

  const classSizes = {
    lowercase: 26,
    uppercase: 26,
    digits: 10,
    symbols: 33, // common printable ASCII symbol range
  };

  const presentClasses = Object.keys(classes).filter((k) => classes[k]);
  const poolSize = presentClasses.reduce(
    (sum, k) => sum + classSizes[k],
    0,
  );

  const entropyBits = poolSize > 0
    ? Math.round(input.length * Math.log2(poolSize) * 100) / 100
    : 0;

  return { entropyBits, characterClasses: presentClasses, poolSize };
}
