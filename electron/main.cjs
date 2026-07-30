const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const readline = require('node:readline');
const { execFile, exec } = require('node:child_process');

let dictionarySet = null;
let dictionaryLoading = null;

// ---------------------------------------------------------------------------
// Bitwarden CLI temp directory management
// ---------------------------------------------------------------------------

/**
 * Temp directory where the Bitwarden CLI is installed via npm.
 * Created on demand and deleted on app cleanup. This avoids relying
 * on the system PATH and ensures the CLI is removed when the app closes.
 */
const BW_TEMP_DIR = path.join(os.tmpdir(), 'digital-healthcheck-bw');

/**
 * Returns the path to the bw executable in the temp directory.
 * On Windows, npm-installed CLIs get a .cmd wrapper in node_modules/.bin.
 * @returns {string}
 */
function getBwPath() {
  if (process.platform === 'win32') {
    return path.join(BW_TEMP_DIR, 'node_modules', '.bin', 'bw.cmd');
  }
  return path.join(BW_TEMP_DIR, 'node_modules', '.bin', 'bw');
}

/**
 * Checks whether the Bitwarden CLI has been installed in the temp dir.
 * @returns {boolean}
 */
function isBwInstalledLocally() {
  try {
    return fs.existsSync(getBwPath());
  } catch {
    return false;
  }
}

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

// Stores the Bitwarden CLI session key after unlock. Passed to all
// subsequent bw commands via --session.
let bwSessionKey = null;

// ---------------------------------------------------------------------------
// Bitwarden CLI integration
// ---------------------------------------------------------------------------

/**
 * Runs the bitwarden CLI (`bw`) with the given args and returns the
 * result. Credentials are passed via args (never logged).
 *
 * Uses the locally-installed CLI (in the temp dir) if available,
 * otherwise falls back to a system-installed `bw` on PATH.
 *
 * @param {string[]} args - CLI arguments.
 * @param {object} [opts] - Extra options (e.g. env overrides).
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runBw(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const bwPath = isBwInstalledLocally() ? getBwPath() : 'bw';
    // Automatically include the session key if we have one (for vault
    // operations after unlock). Don't add it for login/unlock/config
    // commands themselves.
    const finalArgs = [...args];
    const cmd = args[0] || '';
    if (bwSessionKey && !['login', 'unlock', 'config', 'logout'].includes(cmd)) {
      finalArgs.push('--session', bwSessionKey);
    }
    const execOpts = {
      env: { ...process.env, ...opts.env },
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    };
    // On Windows, .cmd files must be run with shell:true.
    if (process.platform === 'win32' && bwPath.endsWith('.cmd')) {
      execOpts.shell = true;
    }
    execFile(bwPath, finalArgs, execOpts, (err, stdout, stderr) => {
      if (err) {
        // When using --response, the CLI outputs JSON to stdout even
        // on error. Include stdout in the error so callers can parse it.
        const error = new Error(stderr || err.message);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
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
// attempts login. Uses --nointeraction to prevent the CLI from hanging
// on an interactive MFA prompt, and --response for structured JSON output
// so we can detect MFA requirements cleanly.
ipcMain.handle('bitwarden:login', async (_event, { serverUrl, email, password }) => {
  try {
    // Configure server if not the default US instance.
    if (serverUrl && serverUrl !== 'https://vault.bitwarden.com') {
      await runBw(['config', 'server', serverUrl]);
    }

    // Attempt login with --nointeraction + --response for clean JSON.
    try {
      const { stdout: loginStdout } = await runBw([
        'login', email, password, '--raw', '--nointeraction', '--response',
      ]);
      // If we get here, login succeeded (CLI exits 0).
      const parsed = JSON.parse(loginStdout);
      if (parsed.success) {
        // Login succeeded — now unlock the vault with the master password.
        // The master password is the same as the login password.
        try {
          const { stdout: unlockStdout } = await runBw([
            'unlock', password, '--raw', '--nointeraction',
          ]);
          bwSessionKey = unlockStdout.trim();
        } catch (unlockErr) {
          // If unlock fails, login still succeeded but vault operations
          // will fail. Return success anyway — the user can deal with
          // vault access issues later.
          console.error('[Bitwarden] Unlock failed:', unlockErr.message);
        }
        return { success: true, output: parsed.raw || '' };
      }
      return parseLoginResponse(parsed);
    } catch (loginErr) {
      // CLI exited non-zero. With --response, the JSON is in stdout
      // (attached to the error object), not in the error message.
      const jsonOutput = loginErr.stdout || '';
      if (jsonOutput) {
        try {
          const parsed = JSON.parse(jsonOutput);
          return parseLoginResponse(parsed);
        } catch {
          // JSON parse failed — fall through to text-based detection.
        }
      }
      // Fallback: check the raw text for MFA indicators.
      const msg = (loginErr.message || '').toLowerCase();
      if (msg.includes('two-step') || msg.includes('two-factor') ||
          msg.includes('2fa') || msg.includes('code is required') ||
          msg.includes('authenticator') || msg.includes('otp')) {
        return { success: false, needsMfa: true, methods: [0, 1] };
      }
      return { success: false, error: loginErr.message };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Parses a Bitwarden CLI --response JSON output and determines whether
 * MFA is required, login failed, or succeeded.
 */
function parseLoginResponse(parsed) {
  if (parsed.success) {
    return { success: true, output: parsed.raw || '' };
  }
  const msg = (parsed.message || '').toLowerCase();
  // MFA-related errors.
  if (msg.includes('two-step') || msg.includes('two-factor') ||
      msg.includes('2fa') || msg.includes('code is required') ||
      msg.includes('authenticator') || msg.includes('otp') ||
      msg.includes('yubikey') || msg.includes('yubi') ||
      msg.includes('email code')) {
    const methods = [];
    if (msg.includes('authenticator')) methods.push(0);
    if (msg.includes('email')) methods.push(1);
    if (msg.includes('yubikey') || msg.includes('yubi')) methods.push(3);
    // If no specific method detected, offer all common ones.
    if (methods.length === 0) methods.push(0, 1);
    return { success: false, needsMfa: true, methods };
  }
  return { success: false, error: parsed.message || 'Sign-in failed.' };
}

// IPC: complete MFA verification after the initial login triggered it.
// The user provides their MFA code and method (0=Authenticator, 1=Email,
// 3=YubiKey). We re-run login with the method and code flags.
ipcMain.handle('bitwarden:mfa', async (_event, { code, method, email, password }) => {
  try {
    const args = ['login', email, password, '--raw', '--nointeraction', '--response'];
    if (method !== undefined && method !== null) {
      args.push('--method', String(method));
    }
    if (code) {
      args.push('--code', code);
    }
    try {
      const { stdout } = await runBw(args);
      const parsed = JSON.parse(stdout);
      if (parsed.success) {
        // MFA login succeeded — now unlock the vault.
        try {
          const { stdout: unlockStdout } = await runBw([
            'unlock', password, '--raw', '--nointeraction',
          ]);
          bwSessionKey = unlockStdout.trim();
        } catch (unlockErr) {
          console.error('[Bitwarden] Unlock failed after MFA:', unlockErr.message);
        }
        return { success: true, output: parsed.raw || '' };
      }
      return { success: false, error: parsed.message || 'MFA verification failed.' };
    } catch (err) {
      const jsonOutput = err.stdout || '';
      if (jsonOutput) {
        try {
          const parsed = JSON.parse(jsonOutput);
          return { success: false, error: parsed.message || 'MFA verification failed.' };
        } catch {
          // JSON parse failed — fall through.
        }
      }
      return { success: false, error: err.message };
    }
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

    // The CLI expects base64-encoded JSON for `bw create item`.
    const itemJson = JSON.stringify(loginItem);
    const encodedJson = Buffer.from(itemJson).toString('base64');
    const { stdout } = await runBw(['create', 'item', encodedJson]);
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

// ---------------------------------------------------------------------------
// Bitwarden installation helpers
// ---------------------------------------------------------------------------

// IPC: install Bitwarden on Windows via winget.
ipcMain.handle('bitwarden:installWindows', async () => {
  return new Promise((resolve) => {
    exec('winget install --id Bitwarden.Bitwarden --accept-source-agreements --accept-package-agreements', {
      windowsHide: true,
      timeout: 120000,
    }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr || err.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
});

// IPC: install the Bitwarden CLI via npm into a temp directory.
// This avoids relying on the system PATH and allows the app to clean
// up the CLI on close. Runs silently while the UI shows a loading screen.
ipcMain.handle('bitwarden:installCli', async () => {
  return new Promise((resolve) => {
    // Ensure the temp directory exists.
    try {
      if (!fs.existsSync(BW_TEMP_DIR)) {
        fs.mkdirSync(BW_TEMP_DIR, { recursive: true });
      }
    } catch (err) {
      resolve({ success: false, error: `Failed to create temp dir: ${err.message}` });
      return;
    }

    // Run npm install in the temp directory.
    exec('npm install @bitwarden/cli', {
      cwd: BW_TEMP_DIR,
      windowsHide: true,
      timeout: 180000,
      env: { ...process.env },
    }, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: stderr || err.message });
      } else if (!isBwInstalledLocally()) {
        resolve({ success: false, error: 'npm install completed but bw executable was not found' });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
});

// IPC: check whether the Bitwarden CLI is available — either in the
// app's temp directory (installed by this app) or on the system PATH.
ipcMain.handle('bitwarden:checkCliInstalled', async () => {
  // Check the local temp dir first.
  if (isBwInstalledLocally()) {
    return { installed: true };
  }
  // Fall back to system PATH.
  return new Promise((resolve) => {
    execFile('where', ['bw'], { windowsHide: true }, (err) => {
      resolve({ installed: !err });
    });
  });
});

// IPC: check whether the Bitwarden desktop app is installed on Windows.
// Looks for the Bitwarden.exe executable in common install locations.
ipcMain.handle('bitwarden:checkDesktopInstalled', async () => {
  const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
  const localAppData = process.env.LOCALAPPDATA || 'C:\\Users\\user\\AppData\\Local';
  const paths = [
    path.join(programFiles, 'Bitwarden', 'Bitwarden.exe'),
    path.join(localAppData, 'Programs', 'Bitwarden', 'Bitwarden.exe'),
    path.join(localAppData, 'Bitwarden', 'Bitwarden.exe'),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        return { installed: true };
      }
    } catch { /* ignore */ }
  }
  return { installed: false };
});

// IPC: detect the user's default browser on Windows by reading the
// registry via `reg query`. Returns a browser id: 'edge', 'chrome',
// 'firefox', or 'other'.
ipcMain.handle('system:detectBrowser', async () => {
  return new Promise((resolve) => {
    exec('reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId', {
      windowsHide: true,
    }, (err, stdout) => {
      if (err) {
        resolve({ browser: 'other' });
        return;
      }
      const output = stdout.toLowerCase();
      if (output.includes('msedge') || output.includes('edge')) {
        resolve({ browser: 'edge' });
      } else if (output.includes('chrome')) {
        resolve({ browser: 'chrome' });
      } else if (output.includes('firefox')) {
        resolve({ browser: 'firefox' });
      } else {
        resolve({ browser: 'other' });
      }
    });
  });
});

// IPC: delete the temp directory where the Bitwarden CLI was installed.
// Called during cleanup to remove the CLI along with all other temp data.
// CRITICAL: This must fully wipe all Bitwarden session data so that
// re-running the app does not see a previous user's session.
ipcMain.handle('bitwarden:cleanupCli', async () => {
  try {
    // 1. Log out of Bitwarden (clears the session in the CLI's data store).
    if (bwSessionKey) {
      try { await runBw(['logout']); } catch { /* ignore — may already be logged out */ }
      bwSessionKey = null;
    }

    // 2. Delete the Bitwarden CLI data directory (contains data.json
    //    with user email, session state, server config, etc.).
    //    On Windows this is %APPDATA%\Bitwarden CLI.
    const bwDataDir = path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Bitwarden CLI',
    );
    try {
      if (fs.existsSync(bwDataDir)) {
        fs.rmSync(bwDataDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('[Bitwarden] Failed to delete data dir:', err.message);
    }

    // 3. Delete the temp directory where the CLI was npm-installed.
    try {
      if (fs.existsSync(BW_TEMP_DIR)) {
        fs.rmSync(BW_TEMP_DIR, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('[Bitwarden] Failed to delete temp dir:', err.message);
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

// CRITICAL: Ensure all Bitwarden session data is wiped before the app
// fully quits, even if closed via Alt+F4, task manager, or OS shutdown.
// This is a synchronous last-resort cleanup — the IPC handler does a
// more thorough async cleanup via the UI, but this catches cases where
// the UI cleanup didn't run.
app.on('before-quit', () => {
  try {
    // Delete the Bitwarden CLI data directory synchronously.
    const bwDataDir = path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Bitwarden CLI',
    );
    if (fs.existsSync(bwDataDir)) {
      fs.rmSync(bwDataDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[Cleanup] Failed to delete Bitwarden data dir on quit:', err.message);
  }

  try {
    // Delete the temp CLI install directory.
    if (fs.existsSync(BW_TEMP_DIR)) {
      fs.rmSync(BW_TEMP_DIR, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('[Cleanup] Failed to delete Bitwarden temp dir on quit:', err.message);
  }
});
