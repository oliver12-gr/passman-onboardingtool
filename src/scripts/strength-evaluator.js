import { calculateEntropy } from './entropy-calculator.js';
import { evaluatePin } from './pin-evaluator.js';
import { checkDictionary } from './dictionary-checker.js';

/**
 * Verdict tiers, ordered from weakest to strongest.
 * Each tier carries a label and a Bootstrap colour variant for the meter.
 */
export const VERDICTS = Object.freeze({
  VERY_WEAK: { label: 'Very weak', variant: 'danger', score: 1 },
  WEAK: { label: 'Weak', variant: 'warning', score: 2 },
  FAIR: { label: 'Fair', variant: 'info', score: 3 },
  STRONG: { label: 'Strong', variant: 'success', score: 4 },
  VERY_STRONG: { label: 'Very strong', variant: 'success', score: 5 },
});

/**
 * Maps an entropy value (in bits) to a verdict tier, ignoring dictionary
 * hits. Used as the baseline before dictionary and PIN adjustments.
 *
 * @param {number} entropyBits
 * @returns {object} A VERDICTS entry.
 */
function verdictFromEntropy(entropyBits) {
  if (entropyBits < 28) return VERDICTS.VERY_WEAK;
  if (entropyBits < 36) return VERDICTS.WEAK;
  if (entropyBits < 60) return VERDICTS.FAIR;
  if (entropyBits < 80) return VERDICTS.STRONG;
  return VERDICTS.VERY_STRONG;
}

/**
 * Combines entropy, PIN, and dictionary checks into a single verdict.
 *
 * The input is never logged or persisted by this module; it is passed
 * straight through to the pure evaluators and the dictionary checker.
 *
 * @param {string} input - Candidate password.
 * @returns {Promise<object>} Verdict object:
 *   { verdict, entropyBits, isPin, inDictionary, dictionaryLoaded, suggestion }
 */
export async function evaluateStrength(input) {
  if (!input) {
    return {
      verdict: null,
      entropyBits: 0,
      isPin: false,
      inDictionary: false,
      dictionaryLoaded: false,
      suggestion: '',
    };
  }

  const pin = evaluatePin(input);
  const entropy = pin.isPin
    ? { entropyBits: pin.entropyBits, characterClasses: ['digits'], poolSize: 10 }
    : calculateEntropy(input);

  const dict = await checkDictionary(input);

  let verdict = verdictFromEntropy(entropy.entropyBits);

  // Anything in the dictionary is at most Very Weak, regardless of entropy.
  if (dict.inDictionary) {
    verdict = VERDICTS.VERY_WEAK;
  }

  // Short PINs are capped at Weak even if not in the dictionary.
  if (pin.isPin && pin.length <= 4 && !dict.inDictionary) {
    verdict = VERDICTS.WEAK;
  }

  const suggestion = buildSuggestion({
    verdict,
    entropyBits: entropy.entropyBits,
    isPin: pin.isPin,
    pinLength: pin.length,
    inDictionary: dict.inDictionary,
    dictionaryLoaded: dict.loaded,
    length: input.length,
  });

  return {
    verdict,
    entropyBits: entropy.entropyBits,
    isPin: pin.isPin,
    inDictionary: dict.inDictionary,
    dictionaryLoaded: dict.loaded,
    suggestion,
  };
}

/**
 * Builds a human-readable, actionable suggestion shown below the bold
 * summary line (strength / time-to-crack / entropy).
 * @param {object} parts
 * @returns {string}
 */
function buildSuggestion(parts) {
  const {
    verdict,
    entropyBits,
    isPin,
    pinLength,
    inDictionary,
    dictionaryLoaded,
    length,
  } = parts;

  if (inDictionary) {
    return `This password appears in a common-password dictionary, so it can be cracked almost instantly. Choose something not found in any list.`;
  }

  if (isPin && pinLength <= 4) {
    return `A ${pinLength}-digit PIN has only ~${entropyBits} bits of entropy — trivially guessable. Use a longer PIN or, better, a passphrase.`;
  }

  if (entropyBits < 28) {
    return `Only ~${entropyBits} bits of entropy at ${length} characters. Lengthen it and mix character types.`;
  }

  if (entropyBits < 60) {
    return `~${entropyBits} bits of entropy. Decent, but a longer passphrase would be much harder to crack.`;
  }

  if (!dictionaryLoaded) {
    return `~${entropyBits} bits of entropy. (Dictionary check unavailable — verdict is based on entropy alone.)`;
  }

  return `~${entropyBits} bits of entropy and not in the common-password dictionary. ${verdict.label}.`;
}
