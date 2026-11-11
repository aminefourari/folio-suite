# Folio

A small, calm office suite that runs in the browser: **Folio Write** (documents), **Folio Grid** (spreadsheets)
and **Folio Stage** (presentations), plus a landing page. Built with [TanStack Start](https://tanstack.com/start),
deployed as Cloudflare Workers, with files stored in Cloudflare D1 (SQLite).

| App | Live | Local |
| --- | --- | --- |
| Landing | https://folio.aminethewiz18.workers.dev | http://localhost:3000 |
| Folio Write | https://folio-write.aminethewiz18.workers.dev | http://localhost:3001 |
| Folio Grid | https://folio-grid.aminethewiz18.workers.dev | http://localhost:3002 |
| Folio Stage | https://folio-stage.aminethewiz18.workers.dev | http://localhost:3003 |

## Features

- **Write**: rich text with styles, Google Fonts, real point sizes, lists, tables, images and links. Download as `.doc`, print or save as PDF.
- **Grid**: formulas (`SUM`, `AVERAGE`, `IF`, `ROUND` and more), range selection, copy and paste with other spreadsheets, number formats, AutoSum, undo and redo, column resizing, and CSV import and export.
- **Stage**: layouts, six themes, speaker notes, drag-to-reorder slides, a full-screen presenter, and PDF export.
- **No account needed to start**: guests create and edit files saved in their browser. "Save online" creates an account (or signs in) and moves those files into it.
- **Accounts**: email and password sign-in with [Better Auth](https://better-auth.com), stored in D1. One sign-in works across all three apps. The account page lets you rename yourself, change your password, sign out everywhere and delete your account (which deletes your files).
- **Files**: templates, search, sort, rename, duplicate, and read-only share links you can turn off at any time.
- **Everywhere**: autosave (debounced, plus Cmd/Ctrl+S, on tab hide and on leaving), custom accessible selects and menus, light and dark mode, and phone layouts.

### How sign-in works across apps

Each app is a separate `*.workers.dev` host, and browsers won't share a cookie between them. The landing app is the
sign-in hub: an app with no session sends you to the hub, which hands back a one-minute, single-use token that the
app swaps for its own session cookie. All apps share one session row in D1, so signing out anywhere signs you out
everywhere. See [docs/PLAN.md](docs/PLAN.md) for the details and the security notes.

## Development

Requires Node 22+ and pnpm 10.

```sh
pnpm install
openssl rand -base64 32                 # put it in .dev.vars in every app, see .dev.vars.example
pnpm dev                                # migrates the local D1, then starts ports 3000–3003
pnpm typecheck
pnpm test                               # formula, CSV, password hashing and redirect-guard tests
pnpm build
```

Open http://localhost:3001 to start as a guest, or http://localhost:3000 to create an account. All apps share one local D1 under `.wrangler/state`.

### Deploying

```sh
pnpm db:migrate:remote                  # apply packages/ui/migrations to the production D1
wrangler secret put BETTER_AUTH_SECRET  # in each apps/* folder, the same value for all four
pnpm run deploy                         # `pnpm deploy` is a pnpm built-in, so use `run`
```

## Layout

```
apps/landing   Landing page (no database)
apps/write     Documents
apps/grid      Spreadsheets (src/formula.ts is the formula engine)
apps/stage     Presentations
packages/ui    Shared UI, styles, Select, autosave hook, D1 storage (server.ts)
```

Folio is an independent project and is not affiliated with any other office software vendor.
