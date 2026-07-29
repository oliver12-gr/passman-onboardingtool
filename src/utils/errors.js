/**
 * Custom error classes per scripting-rules.md error classification.
 * Use these instead of generic Error so callers can branch on type.
 */

export class ValidationError extends Error {
  /**
   * @param {string} message - Human-readable description of the validation failure.
   * @param {object} [context] - Additional diagnostic context (never PII).
   */
  constructor(message, context = {}) {
    super(message);
    this.name = 'ValidationError';
    this.context = context;
  }
}

export class NetworkError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'NetworkError';
    this.context = context;
  }
}

export class DictionaryLoadError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'DictionaryLoadError';
    this.context = context;
  }
}
