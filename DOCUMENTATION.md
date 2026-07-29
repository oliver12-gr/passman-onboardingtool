# Digital Healthcheck — Technical Documentation

## Overview

Digital Healthcheck is a React + Electron desktop application that guides
users through securing their online accounts. It has two phases:

1. **Intro phase** — educational pages about password managers, a password
   strength checker (using the rockyou.txt dictionary of 14M+ known
   passwords).
2. **Onboarding phase** — mode selection, optional Bitwarden sign-in,
   account credential collection, and either direct saving to Bitwarden
   (auto mode) or export to an import file (manual mode). All entered data
   is deleted on close.

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

### Account Services (credential collection targets)

#### Essential accounts

| Service | Website | iOS App ID | Android App ID | Custom URL? |
|---|---|---|---|---|
| Email provider | *(auto-filled from email domain)* | — | — | Yes |
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
| Bitwarden CLI (`bw`) | Login, MFA, save items to vault | `execFile('bw', ...)` via IPC in Electron main |
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
  └─ Bitwarden Intro & Sign-In
     ├─ User signs in → Bitwarden connected
     │  └─ Account Collection (auto mode)
     │     ├─ Essential accounts (email, banking, phone)
     │     ├─ Social media
     │     ├─ Subscriptions
     │     ├─ Review screen
     │     ├─ Submit → Saving to Bitwarden (progress bar)
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
  └─ Bitwarden Intro & Sign-In
     ├─ User signs in → Bitwarden connected
     │  └─ Account Collection (auto mode)
     │     ├─ Essential accounts
     │     ├─ Social media
     │     ├─ Subscriptions
     │     ├─ Review screen
     │     ├─ Submit → Saving to Bitwarden (progress bar)
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
        ├─ Step 3: "Wiping memory..." (final state reset)
        └─ App quits (app.quit())
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
| Bitwarden CLI session | Bitwarden CLI process state | On `bw login` | App quit (CLI session ends with process) | Yes — not persisted by this app |

### What is saved to disk

| Data | File path | When created | When deleted | Deleted on close? |
|---|---|---|---|---|
| Import file (manual mode) | User-chosen path via save dialog (e.g. `digital-healthcheck-import.csv`) | User clicks "Download" on format selection screen | Cleanup function calls `file:delete` → `fs.unlinkSync` | **Yes** — deleted on close, whether via X button or "Close app" |
| rockyou.txt dictionary | `dist/dictionaries/rockyou.txt` (bundled with app) | Bundled at build time, read-only | Never deleted (it is a read-only bundled resource) | N/A — not user data, not created at runtime |

### What is sent over IPC (never over network)

| Data | Direction | Purpose | Persisted? |
|---|---|---|---|
| Password to check | Renderer → Main (`dictionary:check`) | Dictionary lookup | No — looked up in memory, never stored |
| Bitwarden email + password | Renderer → Main (`bitwarden:login`) | CLI login | No — passed to `bw` CLI via args, not logged |
| Bitwarden MFA code | Renderer → Main (`bitwarden:mfa`) | CLI MFA verification | No — passed to `bw` CLI, not logged |
| Account credentials (name, username, password, URL, iOS/Android IDs) | Renderer → Main (`bitwarden:save`) | CLI `bw create item` | No — sent to CLI, not logged by this app |
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
    rockyou.txt              — 14M password dictionary (gitignored)
```
