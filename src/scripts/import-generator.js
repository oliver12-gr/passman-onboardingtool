/**
 * Import file generators for various password managers.
 *
 * Each function takes an array of collected accounts and returns a string
 * (the file contents) in the target format.
 *
 * Account shape:
 *   { name, username, password, url, ios, android, notes, category }
 *
 * SECURITY: These functions only format data the user has explicitly
 * entered. Nothing is logged or sent over the network.
 */

/**
 * Escapes a CSV field value (RFC 4180). Wraps in quotes if it contains
 * commas, quotes, or newlines, and doubles internal quotes.
 * @param {string} value
 * @returns {string}
 */
function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates a Bitwarden CSV import file.
 * @param {object[]} accounts
 * @returns {string}
 */
function generateBitwardenCsv(accounts) {
  const headers = [
    'folder', 'favorite', 'type', 'name', 'notes',
    'fields', 'reprompt', 'login_uri', 'login_username',
    'login_password', 'login_totp',
  ];
  const rows = accounts.map((a) => [
    a.category || '',
    '',
    'login',
    a.name,
    a.notes || '',
    '',
    '',
    a.url || '',
    a.username || '',
    a.password || '',
    '',
  ].map(csvEscape).join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates a Bitwarden JSON import file.
 * @param {object[]} accounts
 * @returns {string}
 */
function generateBitwardenJson(accounts) {
  const items = accounts.map((a) => ({
    type: 'login',
    name: a.name,
    notes: a.notes || '',
    login: {
      username: a.username || '',
      password: a.password || '',
      uris: a.url ? [{ uri: a.url }] : [],
    },
    folder: a.category || '',
  }));

  return JSON.stringify({
    encrypted: false,
    folders: [],
    items,
  }, null, 2);
}

/**
 * Generates a 1Password CSV import file.
 * @param {object[]} accounts
 * @returns {string}
 */
function generate1PasswordCsv(accounts) {
  const headers = [
    'Title', 'Website', 'Username', 'Password', 'Notes',
    'Type', 'URL',
  ];
  const rows = accounts.map((a) => [
    a.name,
    a.url || '',
    a.username || '',
    a.password || '',
    a.notes || '',
    'Login',
    a.url || '',
  ].map(csvEscape).join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates a Proton Pass CSV import file.
 * @param {object[]} accounts
 * @returns {string}
 */
function generateProtonPassCsv(accounts) {
  const headers = [
    'type', 'name', 'note', 'url', 'username', 'password', 'totp',
  ];
  const rows = accounts.map((a) => [
    'login',
    a.name,
    a.notes || '',
    a.url || '',
    a.username || '',
    a.password || '',
    '',
  ].map(csvEscape).join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generates a LastPass CSV import file.
 * @param {object[]} accounts
 * @returns {string}
 */
function generateLastPassCsv(accounts) {
  const headers = [
    'url', 'username', 'password', 'extra', 'name',
    'grouping', 'fav',
  ];
  const rows = accounts.map((a) => [
    a.url || '',
    a.username || '',
    a.password || '',
    a.notes || '',
    a.name,
    a.category || '',
    '',
  ].map(csvEscape).join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Map of format IDs to generator functions.
 */
const GENERATORS = {
  'bitwarden-csv': generateBitwardenCsv,
  'bitwarden-json': generateBitwardenJson,
  '1password-csv': generate1PasswordCsv,
  'protonpass-csv': generateProtonPassCsv,
  'lastpass-csv': generateLastPassCsv,
};

/**
 * Generates an import file in the specified format.
 * @param {string} formatId - One of IMPORT_FORMATS ids.
 * @param {object[]} accounts - Collected accounts.
 * @returns {string} File contents as a string.
 */
export function generateImportFile(formatId, accounts) {
  const gen = GENERATORS[formatId];
  if (!gen) {
    throw new Error(`Unknown import format: ${formatId}`);
  }
  return gen(accounts);
}
