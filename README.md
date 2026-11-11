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
- **Everywhere**: autosave (debounced, plus Cmd/Ctrl+S, on tab hide and on leaving), custom accessible selects, light and dark mode, and phone layouts.

Files belong to the browser that made them, through an anonymous `HttpOnly` cookie. There are no accounts, so files don't sync between devices.

## Development

Requires Node 22+ and pnpm 10.

```sh
pnpm install
pnpm dev          # all four apps (ports 3000–3003), each with a local D1
pnpm typecheck
pnpm test         # formula engine and CSV tests (node --test)
pnpm build
pnpm run deploy   # build and deploy every app with wrangler (`pnpm deploy` is a pnpm built-in)
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
