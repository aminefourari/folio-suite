# Plan: accounts (Better Auth on D1) and file features

Status: implemented and deployed on `feat/auth-and-files`. This document records the design and the order of work.

## Goals

1. **Accounts.** Email and password sign-up and sign-in using [Better Auth](https://better-auth.com), stored in the
   existing Cloudflare D1 database (`folio`). One sign-in works across all four apps.
2. **More features.**
   - File management: search, sort, rename, duplicate.
   - Templates for new files.
   - Read-only share links.
   - An account page: change password, sign out everywhere, delete account.

## Constraint that shapes the design

Each app is its own Worker on its own `*.workers.dev` host. `workers.dev` is on the Public Suffix List, so a cookie
can't be shared between `folio-write.…` and `folio-grid.…`. Single sign-on therefore uses a **one-time-token
hand-off** instead of a shared cookie:

```
App (no session) ──302──▶ Landing /auth/handoff?to=<app URL>
Landing: signed in?  no ─▶ /login?to=…  (sign in or sign up, then back to /auth/handoff)
                     yes ─▶ create a one-time token (Better Auth oneTimeToken plugin, 1 min, single use)
        ──302──▶ App /auth/callback?token=…&next=/path
App: verify token ─▶ Better Auth sets the session cookie for this host ─▶ 302 to /path
```

All apps share the same D1 tables and the same `BETTER_AUTH_SECRET`, so the hand-off reuses the one session row.
Signing out goes through every app's `/auth/signout` in turn (write → grid → stage → landing → `/login`), each
deleting the row if it still exists and expiring that app's session and cache cookies, so this browser is signed out
of every app at once. Sessions use Better Auth's 5-minute cookie cache, so on another device (sign out everywhere,
or a password change that signs out other devices) writes stop immediately (they recheck the row) and reads stop
within 5 minutes.

## Architecture

| Piece | Where |
| --- | --- |
| Better Auth instance (D1, PBKDF2 hashing, rate limiting, one-time tokens, TanStack cookies) | `packages/ui/src/auth.server.ts` |
| Auth HTTP endpoints `/api/auth/*` | `apps/*/src/routes/api/auth/$.ts` |
| Session lookup and route guard (`getViewer`, redirect to the hub) | `packages/ui/src/session.ts` and each app's `__root.tsx` |
| Sign in, sign up, account, hand-off | `apps/landing/src/routes/{login,signup,account}.tsx`, `auth/handoff.ts` |
| Token callback | `apps/{write,grid,stage}/src/routes/auth/callback.ts` |
| Document storage, now scoped by `user.id` | `packages/ui/src/server.ts` |
| Schema | `packages/ui/migrations/*.sql` (applied with `wrangler d1 migrations apply`) |

### Security decisions

- **Password hashing:** PBKDF2-SHA256, 100,000 iterations (the WebCrypto maximum on Workers), 16-byte salt. The
  format is `pbkdf2$<iterations>$<salt>$<hash>`, so the cost can be raised later without breaking old hashes.
  Better Auth's default scrypt is pure JavaScript and too CPU-heavy for Workers.
- **Rate limiting:** Better Auth's limiter, stored in D1 (in-memory counters don't survive across isolates).
  Sign-in and sign-up allow 5 requests per minute; everything else 100 per minute.
- **Redirects:** the hand-off and the login `to` and `next` values only accept the four known origins and same-site
  paths, so neither can be used as an open redirect.
- **Cookies:** `HttpOnly`, `Secure`, `SameSite=Lax`. Better Auth checks the request origin on mutations (CSRF);
  `trustedOrigins` lists the four app origins.
- **Ownership:** every document query filters on the signed-in user's id. Other ids return 404.
- **Share links:** 128-bit random ids. Shared pages are read-only, and shared HTML is sanitized in the browser
  before rendering, the same as in the editor.
- **Not included:** email verification and password reset. Both need an email provider and a sending domain;
  see "Next" below.

## Data model

- `0001_documents.sql`: the existing `documents` table, moved from lazy creation to a migration.
- `0002_auth.sql`: Better Auth's `user`, `session`, `account`, `verification` and `rateLimit` tables. Generated
  with Better Auth's own migration compiler so the column names match exactly.
- `0003_share.sql`: `documents.share_id TEXT UNIQUE` (null means not shared).

`documents.owner` now holds `user.id`. The production database had no real files at the time of the switch, so no
data migration was needed.

## Work, in order

1. **Schema and auth core:** migrations, `auth.server.ts` with PBKDF2 and a unit test, `/api/auth/*` routes, secrets
   (`.dev.vars` locally, `wrangler secret put` in production).
2. **Hub (landing):** sign-in and sign-up pages, `/auth/handoff`, the account page, and a header that shows
   whether you're signed in.
3. **Apps:** a root guard that redirects to the hub, `/auth/callback`, an account menu in every app (switch app,
   account settings, sign out), and document storage scoped by user id.
4. **File management:** search, sort by recent or name, plus a per-file menu with rename, duplicate, share and
   delete.
5. **Templates:** three per app, shown as a "Start from a template" row on each app's home.
6. **Share links:** a Share button in the editor top bar (toggle the link, copy it) and a public `/s/$shareId` view
   per app: a document view, a read-only sheet, and a slide viewer with a presenter.
7. **Verify:** typecheck, tests, build; drive every flow in a browser locally and in production: sign up, single
   sign-on into each app, sign out everywhere, rate limiting, share as a signed-out visitor, and isolation between
   users.
8. **Deploy:** apply migrations remotely, set secrets, deploy all four Workers, re-verify in production.

## Next (not in this change)

- Password reset and email verification with Cloudflare Email Service. This needs a verified sending domain.
- Sign-in with Google or GitHub (Better Auth social providers).
- Version history (snapshots on save, with restore).
- A custom domain with real subdomains, which would allow one shared cookie and remove the hand-off.

## Follow-up: use without an account

Guests can create and edit files without signing up; an account is only needed to save online, share, and open
files on another device.

- **Guest storage:** `packages/ui/src/local.ts` keeps files in `localStorage` (per app, since each app is its own
  origin) behind the same `DocStore` interface as the D1 store. `storeFor(viewer)` in each app's `docs.ts` picks one.
- **Routing:** the root no longer redirects signed-out visitors. The files home and the editor use `ssr: false`,
  because a guest's files only exist in the browser.
- **Save online:** guests see a "Save online" button (home and editor). It signs them in through the hub and comes
  back with `?save=<id>`; the app then moves every browser file into the account, one at a time (each is deleted
  locally only after it saved), and reopens the file they were editing. A signed-in user who still has browser files
  sees a "Move to my account" prompt instead of an automatic move.
- **Limits:** sharing needs an account. Browser storage is about 5 MB per app, so large files or images may need an
  account sooner; the app says so when the browser is full.

