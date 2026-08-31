/**
 * Converts entropy (in bits) into a human-readable estimate of how long
 * a fast offline attack would take to exhaustively search the space.
 *
 * Assumption: 10^10 (10 billion) guesses per second, a commonly cited
 * figure for modern GPU-based offline cracking. This is an estimate for
 * the worst case (full search); average case is half of this.
 *
 * @param {number} entropyBits
 * @returns {{label: string, seconds: number}} A human-readable duration
 *   and the raw seconds value.
 */
export function estimateTimeToCrack(entropyBits) {
  if (!entropyBits || entropyBits <= 0) {
    return { label: 'instantly', seconds: 0 };
  }

  const GUESSES_PER_SECOND = 1e10;
  const totalSeconds = Math.pow(2, entropyBits) / GUESSES_PER_SECOND;

  return { label: formatDuration(totalSeconds), seconds: totalSeconds };
}

/**
 * Formats a duration in seconds into the single most appropriate unit.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds < 1) return 'instantly';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31557600) return `${Math.round(seconds / 2592000)} months`;

  const years = seconds / 31557600;
  if (years < 1000) return `${Math.round(years)} years`;
  if (years < 1e6) return `${Math.round(years / 1000)} thousand years`;
  if (years < 1e9) return `${Math.round(years / 1e6)} million years`;
  if (years < 1e12) return `${Math.round(years / 1e9)} billion years`;
  return `${Math.round(years / 1e12)} trillion years`;
}
