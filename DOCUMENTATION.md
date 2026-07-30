# Digital Healthcheck — Technical Documentation

## Overview

Digital Healthcheck is a React + Electron desktop application that guides
users through securing their online accounts. It has two phases:

1. **Intro phase** — educational pages about password managers, a password
   strength checker (using the rockyou.txt dictionary of 14M+ known
   passwords).
2. **Onboarding phase** — mode selection, optional Bitwarden CLI install,
   Bitwarden sign-in (with MFA support), account credential collection,
   and either direct saving to Bitwarden (auto mode) or export to an import
   file (manual mode). All entered data, CLI installs, and Bitwarden
   sessions are deleted on close.

---

## Tech Stack

| Component | Technology |
|---|---|
| UI framework | React 18 (JavaScript) |
| Build tool | Vite |
| CSS framework | Bootstrap 5 |
| Desktop runtime | Electron |
| Packaging | electron-builder |
| Testing | Vitest + Testing Library |
| Linting | ESLint + Prettier |
| Password manager CLI | Bitwarden CLI (`bw`) |
| Dictionary | rockyou.txt (14,344,390 entries, 133 MB) |

---

## URLs, Apps and Tools Referenced

### Password Managers (import/export targets)

| Name | Website | Import formats supported | Used in |
|---|---|---|---|
| Bitwarden | https://bitwarden.com | CSV, JSON | Auto mode (CLI save), Manual mode (export) |
| Bitwarden EU | https://bitwarden.eu | — | Server selection option |
| Bitwarden sign-up | https://bitwarden.com/go/start-free/ | — | Sign-up button on Bitwarden intro page |
| 1Password | https://1password.com | CSV | Manual mode (export) |
| Proton Pass | https://proton.me/pass | CSV | Manual mode (export) |
| LastPass | https://lastpass.com | CSV | Manual mode (export) |

### Bitwarden server URLs

The CLI requires the vault URL (not the marketing site URL) for `bw config server`:

| Server | CLI server URL | Label shown in UI |
|---|---|---|
| US | `https://vault.bitwarden.com` | US (bitwarden.com) |
| EU | `https://vault.bitwarden.eu` | EU (bitwarden.eu) |
| Self-hosted | *(user-entered)* | Self-hosted |

The US server is the CLI default and does not require a `config` call. EU and
self-hosted servers are configured via `bw config server <url>` before login.

### Account Services (credential collection targets)

#### Essential accounts

| Service | Website | iOS App ID | Android App ID | Custom URL? |
|---|---|---|---|---|
| Email | *(auto-filled from email domain)* | — | — | Yes — saved as "Email - [domain]" |
| Internet banking | *(user-entered)* | — | — | Yes |
| Phone provider | *(user-entered)* | — | — | Yes |

#### Social media

| Service | Website | iOS App ID | Android App ID |
|---|---|---|---|
| Facebook | https://facebook.com | id284882215 | com.facebook.katana |
| Instagram | https://instagram.com | id389801252 | com.instagram.android |
| X (Twitter) | https://x.com | id333903271 | com.twitter.android |
| LinkedIn | https://linkedin.com | id288429040 | com.linkedin.android |
| TikTok | https://tiktok.com | id835599320 | com.zhiliaoapp.musically |

#### Subscriptions

| Service | Website | iOS App ID | Android App ID |
|---|---|---|---|
| Spotify | https://spotify.com | id324684580 | com.spotify.music |
| Netflix | https://netflix.com | id363590051 | com.netflix.mediaclient |
| Amazon Prime Video | https://primevideo.com | id545419333 | com.amazon.avod.thirdpartyclient |
| Disney+ | https://disneyplus.com | id1446075948 | com.disney.disneyplus |
| YouTube | https://youtube.com | id544007664 | com.google.android.youtube |
| Apple Music | https://music.apple.com | id1108187390 | com.apple.android.music |

### Email domain auto-fill mapping

When the user types their email address in the Email provider field, the
URL is auto-filled based on the domain (unless they have manually entered
a URL):

| Domain(s) | Auto-filled URL |
|---|---|
| gmail.com, googlemail.com | https://mail.google.com |
| outlook.com, outlook.co.uk, hotmail.com, hotmail.co.uk, live.com, live.co.uk, msn.com | https://outlook.live.com |
| protonmail.com, proton.me, pm.me | https://mail.proton.me |
| yahoo.com, yahoo.co.uk | https://mail.yahoo.com |
| icloud.com, me.com, mac.com | https://www.icloud.com/mail |
| *(any other domain)* | *(left empty)* |

### Tools

| Tool | Purpose | How invoked |
|---|---|---|
| Bitwarden CLI (`bw`) | Login, MFA, unlock, save items to vault | `execFile('bw', ...)` via IPC in Electron main; installed to temp dir via npm |
| rockyou.txt dictionary | Password strength checking | Loaded into memory via `fs.createReadStream` in Electron main |
| Electron `shell.openExternal` | Open URLs in system browser | IPC handler `shell:openExternal` |
| Electron `dialog.showSaveDialog` | Save import file to disk | IPC handler `file:save` |
| Electron `fs.unlinkSync` | Delete import file on cleanup | IPC handler `file:delete` |

---

## Logic Flows

### Intro Phase (all modes)

```
Welcome page
  └─ "Tell me how" → preloads dictionary in background
     └─ Page 1: What is a password manager?
        └─ Next → Page 2: Why does it matter?
           └─ Next → Page 3: What are the benefits?
              └─ Next → Page 4: Password strength checker
                 └─ "Get Started" → Onboarding phase
```

### Onboarding — Easy Mode

```
Mode Selection (Easy)
  └─ CLI Install (if not already installed)
     └─ Loading screen (npm install @bitwarden/cli to temp dir)
        ├─ Install fails → Error page (Try Again / Switch to Manual)
        └─ Install succeeds
  └─ Bitwarden Intro & Sign-In
     ├─ User signs in → vault unlocked → Bitwarden connected
     │  └─ Account Collection (auto mode)
     │     ├─ Essential accounts (email, banking, phone)
     │     ├─ Social media
     │     ├─ Subscriptions
     │     ├─ Review screen
     │     ├─ Submit → Saving to Bitwarden ("N of M: uploading [name]")
     │     └─ Done page → Close app
     │
     └─ User clicks "skip: use manual mode instead"
        └─ Account Collection (treated as manual mode)
           ├─ Essential accounts
           ├─ Social media
           ├─ Subscriptions
           ├─ Review screen
           ├─ Format selection + download
           ├─ Import instructions (website opens)
           └─ Done page → Close app
```

### Onboarding — Auto Mode

```
Mode Selection (Auto)
  └─ CLI Install (if not already installed)
     └─ Loading screen (npm install @bitwarden/cli to temp dir)
        ├─ Install fails → Error page (Try Again / Switch to Manual)
        └─ Install succeeds
  └─ Bitwarden Intro & Sign-In
     ├─ User signs in → vault unlocked → Bitwarden connected
     │  └─ Account Collection (auto mode)
     │     ├─ Essential accounts
     │     ├─ Social media
     │     ├─ Subscriptions
     │     ├─ Review screen
     │     ├─ Submit → Saving to Bitwarden ("N of M: uploading [name]")
     │     └─ Done page → Close app
     │
     └─ User clicks "skip: use manual mode instead"
        └─ Account Collection (treated as manual mode)
           ├─ Essential accounts
           ├─ Social media
           ├─ Subscriptions
           ├─ Review screen
           ├─ Format selection + download
           ├─ Import instructions (website opens)
           └─ Done page → Close app
```

### Onboarding — Manual Mode

```
Mode Selection (Manual)
  └─ (Bitwarden page skipped)
     └─ Account Collection (manual mode)
        ├─ Essential accounts
        ├─ Social media
        ├─ Subscriptions
        ├─ Review screen
        ├─ Format selection + download
        ├─ Import instructions (website opens)
        └─ Done page → Close app
```

### Close Flow (all modes, triggered by X button or "Close app" button)

```
User clicks X (top-right) or "Close app" (done page)
  └─ Warning overlay appears
     ├─ "Cancel" → returns to previous state
     └─ "Delete then close" →
        ├─ Step 1: "Clearing entered credentials..." (clears React state)
        ├─ Step 2: "Removing temporary files..." (deletes import file if exists)
        ├─ Step 3: "Uninstalling Bitwarden CLI..." (bw logout, delete data dir, delete temp dir)
        ├─ Step 4: "Wiping memory..." (final state reset)
        └─ App quits (app.quit())

Fallback (Alt+F4, task manager, OS shutdown):
  └─ before-quit handler runs synchronously:
     ├─ Delete %APPDATA%\Bitwarden CLI (session data, settings)
     └─ Delete %TEMP%\digital-healthcheck-bw (CLI install)
```

---

## Data Caching and Deletion

### What is stored in memory

| Data | Where stored | When created | When deleted | Deleted on close? |
|---|---|---|---|---|
| Selected mode (easy/auto/manual) | React state in `OnboardingFlow` | Mode selection page | Component unmount / app quit | Yes (in-memory only) |
| Bitwarden connection status | React state in `OnboardingFlow` | Successful Bitwarden login | Component unmount / app quit | Yes (in-memory only) |
| Skipped Bitwarden flag | React state in `OnboardingFlow` | User clicks "skip" | Component unmount / app quit | Yes (in-memory only) |
| Selected services (which accounts user uses) | React state in `AccountCollectionPage` | User toggles service cards | Cleanup function / component unmount | Yes — cleared by cleanup `clearFn` |
| Entered credentials (usernames, passwords, URLs) | React state in `AccountCollectionPage` | User types in credential forms | Cleanup function / component unmount | Yes — cleared by cleanup `clearFn` |
| `urlManuallySet` flag per service | React state in `AccountCollectionPage` | User manually edits URL field | Cleanup function / component unmount | Yes — cleared with credentials |
| `showPassword` toggle per service | React state in `AccountCollectionPage` | User clicks Show/Hide | Cleanup function / component unmount | Yes — cleared with credentials |
| Import format selection | React state in `AccountCollectionPage` | User selects format dropdown | Component unmount / app quit | Yes (in-memory only) |
| Submit progress / status / errors | React state in `AccountCollectionPage` | During Bitwarden save or file download | Component unmount / app quit | Yes (in-memory only) |
| Downloaded file path | React state in `AccountCollectionPage` + registered in `CleanupContext` | File save dialog completes | Cleanup function deletes file from disk | Yes — file deleted via `file:delete` IPC |
| Files to delete list | React state in `CleanupProvider` | Registered by account collection page | Cleanup function runs `file:delete` for each | Yes |
| Progress bar value | React state in `AppContext` reducer | Updated on each step change | App quit | Yes (in-memory only) |
| Dictionary (rockyou.txt) | `Set` in Electron main process | First password check / preload call | App quit (process exits) | Yes — process termination frees memory |
| Bitwarden CLI session key | `bwSessionKey` variable in Electron main | On `bw unlock` after login | `bw logout` + cleared on cleanup | Yes — logged out and cleared on close |
| Bitwarden CLI session data | `%APPDATA%\Bitwarden CLI\data.json` | On `bw login` (created by CLI) | Deleted on close via `bitwarden:cleanupCli` IPC + `before-quit` handler | **Yes** — directory deleted on close |

### What is saved to disk

| Data | File path | When created | When deleted | Deleted on close? |
|---|---|---|---|---|
| Import file (manual mode) | User-chosen path via save dialog (e.g. `digital-healthcheck-import.csv`) | User clicks "Download" on format selection screen | Cleanup function calls `file:delete` → `fs.unlinkSync` | **Yes** — deleted on close, whether via X button or "Close app" |
| Bitwarden CLI install | `%TEMP%\digital-healthcheck-bw\` (npm install of `@bitwarden/cli`) | On first run in Auto/Easy mode if CLI not already installed | `bitwarden:cleanupCli` IPC handler + `before-quit` handler | **Yes** — temp directory deleted on close |
| Bitwarden CLI session data | `%APPDATA%\Bitwarden CLI\data.json` | On `bw login` (created by the CLI itself) | `bitwarden:cleanupCli` IPC handler + `before-quit` handler | **Yes** — directory deleted on close |
| rockyou.txt dictionary | `dist/dictionaries/rockyou.txt` (bundled with app) | Bundled at build time, read-only | Never deleted (it is a read-only bundled resource) | N/A — not user data, not created at runtime |

### What is sent over IPC (never over network)

| Data | Direction | Purpose | Persisted? |
|---|---|---|---|
| Password to check | Renderer → Main (`dictionary:check`) | Dictionary lookup | No — looked up in memory, never stored |
| Bitwarden email + password | Renderer → Main (`bitwarden:login`) | CLI login + unlock | No — passed to `bw` CLI via args, not logged |
| Bitwarden MFA code + method | Renderer → Main (`bitwarden:mfa`) | CLI MFA verification + unlock | No — passed to `bw` CLI, not logged |
| Account credentials (name, username, password, URL, iOS/Android IDs) | Renderer → Main (`bitwarden:save`) | CLI `bw create item` (base64-encoded JSON) | No — sent to CLI, not logged by this app |
| CLI install check | Renderer → Main (`bitwarden:checkCliInstalled`) | Check if CLI exists in temp dir | No — filesystem check only |
| CLI install request | Renderer → Main (`bitwarden:installCli`) | `npm install @bitwarden/cli` to temp dir | Yes — temp dir, deleted on close |
| CLI cleanup | Renderer → Main (`bitwarden:cleanupCli`) | `bw logout`, delete data dir + temp dir | N/A — deletes data |
| Import file contents | Renderer → Main (`file:save`) | Write to disk via save dialog | Yes — saved to user-chosen path, deleted on close |
| File path to delete | Renderer → Main (`file:delete`) | `fs.unlinkSync` | N/A — deletes the file |

### What is never stored

- **No credentials are written to disk** by this application (except the
  user-initiated import file in manual mode, which is deleted on close).
- **No credentials are logged** to console or files.
- **No credentials are sent over the network** — all IPC is in-process.
- **No persistent storage** (localStorage, IndexedDB, cookies) is used
  for credentials.
- **The Electron session filter blocks all remote content** — no
  http/https requests are allowed from the renderer (except an optional
  dev server URL during development).

---

## Bitwarden CLI Integration

### Installation

The Bitwarden CLI is installed on-demand when the user selects Auto or Easy
mode. It is installed via `npm install @bitwarden/cli` into a temp directory
(`%TEMP%\digital-healthcheck-bw`), not globally. This avoids PATH issues and
allows clean removal on app close.

| Step | Action |
|---|---|
| Check if installed | `bitwarden:checkCliInstalled` — checks if `bw.cmd` exists in temp dir |
| Install | `bitwarden:installCli` — runs `npm install @bitwarden/cli` in temp dir |
| Loading screen | `CliInstallLoader` component shows cycling messages + progress bar |
| Install failure | Error page with "Try Again" or "Switch to Manual Mode" options |

### Login Flow

```
bw config server <url>       (EU / self-hosted only)
bw login <email> <password> --raw --nointeraction --response
  ├─ Success → bw unlock <password> --raw --nointeraction  → store session key
  ├─ MFA required → return needsMfa to renderer → show MFA input
  │   └─ bw login <email> <password> --method <0|1|3> --code <code> --raw --nointeraction --response
  │       └─ Success → bw unlock <password> --raw --nointeraction → store session key
  └─ Error → formatBwError() → user-friendly message
```

Key flags:
- `--nointeraction` — prevents the CLI from hanging on interactive prompts
- `--response` — returns structured JSON (`{"success":false,"message":"..."}`)
- `--raw` — returns just the session key on success

### MFA Methods

| Value | Method |
|---|---|
| 0 | Authenticator app |
| 1 | Email |
| 3 | YubiKey |

The MFA screen includes a dropdown to select the method and a text field for
the code. The selected method is passed via `--method` and the code via
`--code`.

### Vault Operations

After login, the vault is **locked**. The app runs `bw unlock` with the
master password to obtain a session key (`BW_SESSION`). This session key is
stored in a variable in the Electron main process and automatically appended
to all subsequent `bw` commands via `--session`.

| Operation | Command |
|---|---|
| Save item | `bw create item <base64-encoded-json> --session <key>` |
| Logout | `bw logout --session <key>` |

The `bw create item` command expects **base64-encoded JSON** (not raw JSON).
The app encodes the item via `Buffer.from(json).toString('base64')`.

### Error Handling

The `formatBwError()` function in `bitwarden-intro-page.jsx` detects common
errors and replaces raw CLI output (including JSON error blobs) with
user-friendly messages:

| Error pattern | User-friendly message |
|---|---|
| 522 / connection timed out | "The Bitwarden server is temporarily unavailable..." |
| 503 / service unavailable | "The Bitwarden server is temporarily unavailable..." |
| 401 / unauthorized | "Your email or password is incorrect..." |
| 429 / rate limit | "Too many login attempts. Please wait..." |
| Captcha required | "Bitwarden requires a captcha challenge..." |
| Invalid email/username | "The email address you entered is not recognised..." |
| Network errors | "Could not connect to the Bitwarden server..." |
| "Unable to fetch ServerConfig" | "Could not reach the Bitwarden server..." |
| ENOENT / spawn bw | "The Bitwarden CLI could not be found..." |

### Cleanup

On app close, all Bitwarden data is wiped in three layers:

1. **UI cleanup** (`bitwarden:cleanupCli` IPC handler):
   - `bw logout` (clears CLI session)
   - Delete `%APPDATA%\Bitwarden CLI` directory (session data, settings)
   - Delete `%TEMP%\digital-healthcheck-bw` directory (CLI install)

2. **`before-quit` handler** (synchronous fallback for Alt+F4, task manager):
   - Delete `%APPDATA%\Bitwarden CLI` directory
   - Delete `%TEMP%\digital-healthcheck-bw` directory

3. **React state cleanup** (`CleanupProvider`):
   - Clears all credentials from React state
   - Deletes any generated import files from disk

---

## Security Architecture

| Layer | Mechanism |
|---|---|
| Electron context isolation | Enabled (`contextIsolation: true`) |
| Node integration | Disabled (`nodeIntegration: false`) |
| Sandbox | Enabled (`sandbox: true`) |
| Preload script | Sandboxed, exposes only IPC bridge via `window.appRuntime` |
| CSP | Blocks remote content; only `file://` and inline styles |
| Session filter | All `http://` and `https://` requests cancelled (except dev server) |
| External links | Opened in system browser via `shell.openExternal`, not in-app |
| Native title bar | Removed (`frame: false`); custom X button triggers cleanup |
| Credentials in state | Cleared on close via `CleanupProvider` |
| Import file on disk | Deleted on close via `fs.unlinkSync` |
| Bitwarden CLI session | `bw logout` + session key cleared on close |
| Bitwarden CLI data dir | `%APPDATA%\Bitwarden CLI` deleted on close |
| Bitwarden CLI install | `%TEMP%\digital-healthcheck-bw` deleted on close |
| `before-quit` fallback | Sync deletion of CLI data + temp dir even on Alt+F4 |
| Dictionary | Read-only bundled file; loaded into memory, never written |

---

## File Structure (key files)

```
electron/
  main.cjs          — Electron main process, IPC handlers, dictionary loader
  preload.cjs       — Sandboxed preload, exposes window.appRuntime

src/
  app/
    app.jsx              — Root component, phase switching
    app-context.jsx      — Global state (phase, progress)
    cleanup-context.jsx  — Global cleanup provider (data deletion on close)
  components/
    progress-bar.jsx         — Top progress bar with title
    global-close-button.jsx  — X button (triggers cleanup)
    key-particles.jsx        — Animated background
    nav-button.jsx           — Reusable button
    strength-meter.jsx       — Password strength display
    cli-install-loader.jsx   — Loading screen during Bitwarden CLI install
  content/
    intro-content.js         — Educational page text
    onboarding-content.js    — Mode options, Bitwarden config
    account-content.js       — Account categories, services, import formats
  pages/
    intro-flow.jsx           — Intro phase controller
    intro-page.jsx           — Generic intro content page
    mode-select-page.jsx     — Easy/Auto/Manual selection
    bitwarden-intro-page.jsx — Bitwarden sign-in + server selection + MFA
    account-collection-page.jsx — Credential collection, review, submit, done
    onboarding-flow.jsx      — Onboarding phase controller
  scripts/
    dictionary-checker.js    — Password dictionary lookup (IPC + fallback)
    import-generator.js      — Import file generators (5 formats)
  styles/
    app.css                  — All application styles

public/
  dictionaries/
    rockyou.txt              — 14M password dictionary (tracked in git)
```
