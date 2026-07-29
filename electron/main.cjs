const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');
const { execFile } = require('node:child_process');

let dictionarySet = null;
let dictionaryLoading = null;

/**
 * Lazily loads the bundled rockyou.txt wordlist into a lowercase Set
 * using async streaming so the main process event loop is not blocked.
 * Cached after first load. The 14M-entry file takes a few seconds to
 * parse on first use; subsequent lookups are O(1).
 *
 * @returns {Promise<Set<string>>}
 */
function loadDictionary() {
  if (dictionarySet) return Promise.resolve(dictionarySet);
  if (dictionaryLoading) return dictionaryLoading;

  dictionaryLoading = new Promise((resolve, reject) => {
    const dictPath = path.join(__dirname, '..', 'dist', 'dictionaries', 'rockyou.txt');
    const stream = fs.createReadStream(dictPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const set = new Set();

    rl.on('line', (line) => {
      const trimmed = line.trim().toLowerCase();
      if (trimmed) set.add(trimmed);
    });

    rl.on('close', () => {
      dictionarySet = set;
      console.log(`[Dictionary] Loaded ${set.size} entries`);
      resolve(set);
    });

    rl.on('error', (err) => {
      dictionaryLoading = null;
      reject(err);
    });
  });

  return dictionaryLoading;
}

// IPC: preload the dictionary into memory without checking anything.
// Called early (e.g. on "Tell me how" click) so it's ready by the time
// the user reaches the password checker.
ipcMain.handle('dictionary:preload', async () => {
  try {
    await loadDictionary();
    return { loaded: true };
  } catch (err) {
    console.error('[Dictionary] Preload failed:', err.message);
    return { loaded: false };
  }
});

// IPC: check whether a password appears in the dictionary.
// The input is lowercased before lookup and never persisted or logged.
ipcMain.handle('dictionary:check', async (_event, input) => {
  if (!input) return { inDictionary: false, loaded: false };
  try {
    const dict = await loadDictionary();
    return { inDictionary: dict.has(input.toLowerCase()), loaded: true };
  } catch (err) {
    console.error('[Dictionary] Load failed:', err.message);
    return { inDictionary: false, loaded: false };
  }
});

// ---------------------------------------------------------------------------
// Bitwarden CLI integration
// ---------------------------------------------------------------------------

/**
 * Runs the bitwarden CLI (`bw`) with the given args and returns the
 * result. Credentials are passed via args (never logged). The CLI is
 * expected to be on the system PATH.
 *
 * @param {string[]} args - CLI arguments.
 * @param {object} [opts] - Extra options (e.g. env overrides).
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runBw(args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile('bw', args, {
      env: { ...process.env, ...opts.env },
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// IPC: open an external URL in the default browser (for sign-up link).
ipcMain.handle('shell:openExternal', (_event, url) => {
  shell.openExternal(url);
});

// IPC: check if the bitwarden CLI is installed and available.
ipcMain.handle('bitwarden:status', async () => {
  try {
    const { stdout } = await runBw(['status']);
    const parsed = JSON.parse(stdout);
    return { installed: true, ...parsed };
  } catch (err) {
    return { installed: false, error: err.message };
  }
});

// IPC: configure the server before login (for EU / self-hosted).
ipcMain.handle('bitwarden:config', async (_event, serverUrl) => {
  try {
    await runBw(['config', 'server', serverUrl]);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: log in to Bitwarden. Sets the server first if non-US, then
// attempts login. If MFA is required, returns needsMfa: true so the
// renderer can prompt for the code.
ipcMain.handle('bitwarden:login', async (_event, { serverUrl, email, password }) => {
  try {
    // Configure server if not the default US instance.
    if (serverUrl && serverUrl !== 'https://bitwarden.com') {
      await runBw(['config', 'server', serverUrl]);
    }

    // Attempt login. The CLI may prompt for 2FA interactively, which
    // doesn't work with execFile. We use --code to pass MFA if we have
    // it, but on first attempt we don't — so we catch the MFA prompt.
    try {
      const { stdout } = await runBw(['login', email, password, '--raw']);
      return { success: true, output: stdout };
    } catch (loginErr) {
      const msg = loginErr.message.toLowerCase();
      // Detect MFA requirement from the CLI output.
      if (msg.includes('two-factor') || msg.includes('2fa') ||
          msg.includes('authenticator') || msg.includes('otp') ||
          msg.includes('two-step')) {
        return { success: false, needsMfa: true };
      }
      throw loginErr;
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: complete MFA verification after the initial login triggered it.
ipcMain.handle('bitwarden:mfa', async (_event, { code }) => {
  try {
    // The CLI retains the email/password from the prior login attempt;
    // we pass the --code flag to complete 2FA.
    const { stdout } = await runBw(['login', '--code', code, '--raw']);
    return { success: true, output: stdout };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: save a single login item to the Bitwarden vault via the CLI.
// The item includes the service name, URL, iOS/Android identifiers,
// username, and password. Credentials are never logged.
ipcMain.handle('bitwarden:save', async (_event, item) => {
  try {
    // Build a JSON item object that the CLI can create via `bw create`.
    const loginItem = {
      type: 1, // login
      name: item.name,
      notes: item.notes || '',
      login: {
        username: item.username || '',
        password: item.password || '',
        uris: [],
      },
      folderId: null,
    };

    if (item.url) {
      loginItem.login.uris.push({ uri: item.url });
    }

    // Store iOS/Android app IDs in custom fields if provided.
    const fields = [];
    if (item.ios) fields.push({ name: 'iOS App ID', value: item.ios, type: 0 });
    if (item.android) {
      fields.push({ name: 'Android App ID', value: item.android, type: 0 });
    }
    if (fields.length > 0) loginItem.fields = fields;

    // Create the item via the CLI.
    const itemJson = JSON.stringify(loginItem);
    const { stdout } = await runBw(['create', 'item', itemJson]);
    return { success: true, id: stdout.trim() };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: save a file to disk (for manual mode import file download).
ipcMain.handle('file:save', async (_event, { defaultName, content }) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Import file', extensions: ['csv', 'json'] }],
  });
  if (result.canceled || !result.filePath) {
    return { saved: false };
  }
  try {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { saved: true, path: result.filePath };
  } catch (err) {
    return { saved: false, error: err.message };
  }
});

// IPC: delete a file (used during cleanup to remove generated import files).
ipcMain.handle('file:delete', async (_event, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { deleted: true };
  } catch (err) {
    return { deleted: false, error: err.message };
  }
});

// IPC: quit the application (used after cleanup is complete).
ipcMain.handle('app:quit', () => {
  app.quit();
});

/**
 * Creates the main application window with security-hardened defaults.
 * @returns {void}
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    resizable: true,
    title: 'Digital Healthcheck',
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  // Always load the built dist/index.html. The `electron:dev` script
  // runs `vite build` first; for live HMR, run `npm run dev` separately
  // and set the ELECTRON_DEV_SERVER_URL env var before launching.
  const devServerUrl = process.env.ELECTRON_DEV_SERVER_URL;
  const indexUrl = devServerUrl
    ? devServerUrl
    : `file://${path.join(__dirname, '..', 'dist', 'index.html')}`;

  win.loadURL(indexUrl);
}

// Lock down the default session: disallow remote content entirely.
app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Only an explicit dev server URL (via env var) is permitted.
      const allowed = process.env.ELECTRON_DEV_SERVER_URL;
      if (allowed && url.startsWith(allowed)) {
        return callback({});
      }
      return callback({ cancel: true });
    }
    callback({});
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
