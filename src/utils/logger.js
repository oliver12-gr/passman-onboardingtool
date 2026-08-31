/**
 * Structured JSON logger. Emits one JSON object per line to the console.
 *
 * Security: NEVER pass user-supplied secrets (e.g. passwords being checked)
 * to this logger. Only non-PII diagnostic context is permitted.
 */

const LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, FATAL: 50 };
const ENV = import.meta.env?.MODE ?? 'development';

/**
 * @param {string} level - One of DEBUG, INFO, WARN, ERROR, FATAL.
 * @param {string} message - Short summary of the event.
 * @param {object} [context] - Additional non-PII fields to include.
 * @returns {void}
 */
function emit(level, message, context = {}) {
  if (LEVELS[level] < LEVELS.INFO && ENV === 'production') return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: ENV,
    ...context,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg, ctx) => emit('DEBUG', msg, ctx),
  info: (msg, ctx) => emit('INFO', msg, ctx),
  warn: (msg, ctx) => emit('WARN', msg, ctx),
  error: (msg, ctx) => emit('ERROR', msg, ctx),
  fatal: (msg, ctx) => emit('FATAL', msg, ctx),
};
