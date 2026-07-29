# Digital Healthcheck

A secure-by-design desktop onboarding workflow that walks a user through
adopting a password manager. Built with React + JavaScript, Vite,
Bootstrap 5, and packaged as a Windows executable via Electron.

## Status

Phase 1 ("starting blocks") is complete:

- Three short intro pages (what / why / benefits of a password manager),
  one concept per page with a Next button anchored bottom-right.
- An offline password strength checker as the final intro screen, with
  entropy, PIN, and bundled-dictionary (rockyou.txt) evaluation.
- A "Get Started" button that transitions to the onboarding shell with a
  persistent top-of-screen progress bar.
- A placeholder first onboarding step (see `placeholders.md`).

The full plan lives in `project-planning/implementation-plan.md` (gitignored).

## Security model

- The strength checker holds the entered password only in component state
  for the duration of the check. It is cleared on unmount and on
  transition, and is never logged, persisted, or sent over the network.
- Electron runs with context isolation enabled, `nodeIntegration` off,
  and a CSP that disallows remote content.
- The bundled `rockyou.txt` is a read-only asset used for local
  dictionary lookups only.

## Prerequisites

- Node.js 22+ (tested on Node 24)
- npm 10+

## Scripts

| Script                 | Description                                  |
|------------------------|----------------------------------------------|
| `npm run dev`          | Start the Vite dev server (browser, port 5173)|
| `npm run build`        | Production build to `dist/`                  |
| `npm run preview`      | Preview the production build in a browser    |
| `npm test`             | Run the Vitest suite once                    |
| `npm run test:watch`   | Run tests in watch mode                      |
| `npm run test:coverage`| Run tests with V8 coverage                   |
| `npm run lint`         | Lint with ESLint                             |
| `npm run format`       | Format with Prettier                         |
| `npm run format:check` | Check formatting without writing             |
| `npm run electron:dev` | Build then launch in Electron (packaged mode)|
| `npm run dist`         | Build and produce a Windows installer/exe    |

## Running as a desktop app

For development against the Vite dev server, start `npm run dev` in one
terminal and point `electron/main.js` at `http://localhost:5173` (already
configured for unpackaged runs).

To package a Windows executable:

```bash
npm run dist
```

Output is written to `release/` (NSIS installer + portable executable).

## Project layout

```
electron/        Electron main + preload (context-isolated)
public/dictionaries/  Bundled read-only wordlist assets
src/app/         Root component + app-wide context
src/pages/       Top-level screens (intro, strength checker, onboarding)
src/components/  Reusable UI (nav button, strength meter, progress bar)
src/scripts/     Pure logic (entropy, PIN, dictionary, strength evaluator)
src/content/     Editable copy
src/styles/      Custom CSS layered on Bootstrap
src/utils/       Logger + custom error classes
tests/           Mirrors src/ structure
```

## Conventions

This project follows the rules in `project-planning/scripting-rules.md`:

- Files use kebab-case; React components use `.jsx`.
- Code files stay under 300 lines.
- Custom error classes instead of generic `Error`.
- Structured JSON logging; no PII is ever logged.
- Placeholders are marked with `// PLACEHOLDER:` and logged in
  `placeholders.md`.
- Conventional commit messages (`feat:`, `fix:`, `docs:`).
