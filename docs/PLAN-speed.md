# Plan: make switching apps, signing in and loading feel instant

Status: implemented (sections 1 to 7), not yet deployed; Verify step 3 is pending. Scope is perceived and real speed plus the UI states around it. No redesign.
Differences from the text below: the self-hosted face is named `'Folio UI'` (the Google stylesheet also declares `Instrument Sans` and, loaded later, won, so the preload went unused); `loadViewer` is seeded from the server-rendered viewer so the first navigation makes no call either; the account page's name change calls `forgetViewer()`.

## What was measured (production, 2026-11-12)

| Finding | Evidence | Cost to the user |
| --- | --- | --- |
| Hashed JS/CSS is served `cache-control: public, max-age=0, must-revalidate` | `curl -I …/assets/index-*.js` | Every page load and every app switch revalidates ~140 KB over 5 requests before anything runs |
| The root `beforeLoad` calls the `getViewer` server function on **every** client navigation | `apps/*/src/routes/__root.tsx` | Opening a file = `getViewer` (~150 ms) then `getDoc` (~200 ms), one after the other. Same for going back to the files grid and for login ↔ signup |
| Home and editor routes are `ssr: false` with no pending component | `routes/index.tsx`, `routes/doc.$id.tsx` | After a switch the server sends an empty body: white page until JS has loaded *and* the file list has arrived |
| The Google Fonts stylesheet (8 families, 12.5 KB) is render-blocking on a third origin | `rootHead` in `root.tsx` | workers.dev hosts are separate sites, so the browser cache is partitioned: each app pays for it again |
| A signed-in user who opens another app for the first time lands there as a guest | `SuiteNav` links straight to the app; only "Sign in" starts the hand-off | Looks like the files are gone; needs an extra click and three redirects |
| Cards animate in for 0.6 s with a 40 ms stagger (up to 12 steps) | `.card` in `styles.css` | Every load of the grid takes about a second to settle |
| `/login` and `/signup` redirect signed-in visitors in a `useEffect` | `login.tsx`, `signup.tsx` | The form flashes before the redirect |
| One D1 query costs 40 to 90 ms (database in EEUR) | timing of `/` against `/s/<id>` and `/api/auth/get-session` | Sets the floor for every server call, so the fix is fewer calls, not faster ones |

## Changes, in order of impact

### 1. Cache hashed assets forever
Add `packages/ui/public/_headers` (it is every app's `publicDir`, so it ships with all four Workers):

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
```

Check after `pnpm build` that `_headers` is in each app's client output next to `sw.js`. `sw.js` itself must keep revalidating.

### 2. Ask for the viewer once per page, not once per navigation
In `packages/ui/src/session.ts` add `loadViewer()`: on the server it calls `getViewer()`; in the browser it memoises the promise for the lifetime of the page and forgets it if the call rejects (offline). Every sign-in, sign-out and account deletion is already a full page load, so the memo cannot go stale in a way that matters; confirm that for the name change in `account.tsx` and reset the memo there if it updates in place. Use it in all four roots.

### 3. Paint the shell straight away
- `FileHomeSkeleton({ app })` in `chrome.tsx`: the real `SuiteNav`, the hero with the app mark, and six placeholder cards. Use it as `pendingComponent` on the three `index` routes. The server renders a route's pending component for `ssr: false` routes, so the nav and the highlighted tab arrive in the first HTML. Confirm with `curl` against `pnpm dev` that the HTML contains `suite-nav`.
- An editor skeleton as `pendingComponent` on the three `doc.$id` routes: the top bar outline and an empty page/sheet/slide in the right place (Stage already has `.stage-loading`; reuse the idea, one shared class in `styles.css`).
- In each `router.tsx`: `defaultPendingMs: 150, defaultPendingMinMs: 0`. The default minimum of 500 ms keeps a skeleton on screen long after the data is there.
- Skeletons use one shared `.skeleton` class with a slow opacity pulse, disabled under `prefers-reduced-motion` (the global rule already covers it).

### 4. Stop the font stylesheet from blocking the first paint
- Self-host the UI font: download the Instrument Sans variable latin `woff2` (OFL) into `packages/ui/public/fonts/`, declare it with `@font-face` (`font-display: swap`, weight `400 700`) at the top of `styles.css`, and add a `preload` link for it in `rootHead`.
- Load the Google Fonts stylesheet (document fonts) without blocking: remove it from `rootHead` links and append the `<link rel="stylesheet">` from a `useEffect` in a small component rendered by `RootShell`. Keep the two `preconnect` hints. `GOOGLE_FONTS_HREF` stays as it is.

### 5. Switching apps
- **Automatic sign-in on the other app.** Links to another app made while signed in (`SuiteNav`, `AccountMenu`, the app cards on the landing page) carry `?sso=1`. One shared helper in `packages/ui` used by the three app roots: when the request has `sso` and there is no viewer, redirect (server side, `redirect({ href })`) to `signInUrl(<this URL without sso>)`; when there is a viewer, carry on and strip the parameter from the address bar on the client. The redirect target is built from the app's own origin, never from the query string, so the redirect guards still hold, and the hand-off returns to a URL without `sso`, so it cannot loop.
- **Feedback on click.** A cross-origin navigation shows nothing until the next page paints. In `SuiteNav`, on click, mark the clicked tab as current (`aria-current`) and show a thin indeterminate progress bar at the top of the window. Reset both on `pageshow` so the back/forward cache does not restore a stuck state. Use the same bar for in-app navigation via `useRouterState({ select: (s) => s.status === 'pending' })`, shown only after 150 ms.
- `preconnect` links in `rootHead` to the other three Folio origins.
- Card entrance: 0.6 s → 0.3 s, stagger 40 ms → 20 ms, capped at 6 steps. Same change for `.auth-card`.

### 6. Signing in
- `/login` and `/signup`: move the "already signed in" redirect from `useEffect` into the route's `beforeLoad` (`throw redirect({ href: afterAuth(to) })`), so it happens on the server with no flash.
- Buttons say what is happening: "Signing in…" / "Creating account…", then "Opening Folio Write…" (the name of the target app, or "Opening Folio…") once the request has succeeded and the browser is redirecting. Reset the busy state on `pageshow` when `event.persisted`.
- No change to the hand-off itself or to the security settings (PBKDF2 cost, rate limits, token lifetime).

### 7. Files grid feedback
- "New …" and template buttons show a spinner while the file is being created.
- A card whose rename, duplicate or delete is in flight is dimmed with `aria-busy` until the list has refreshed.

### 8. Session cookie cache
- `cookieCache: { enabled: true, maxAge: 300 }` in `auth.server.ts`: reads (`getViewer`, the file list, opening a file) check a signed cookie instead of the session row, saving a 40 to 90 ms D1 read per server call.
- A cached session stays valid until it expires even after its row is deleted, so writes (`create`, `save`, `rename`, `remove`, `setShare`, and `duplicate` through `create`) call `requireUserId('fresh')`, which rechecks the row. Better Auth already rechecks it for change password, sign out everywhere and delete account; a `hooks.before` in `auth.server.ts` does the same for `/update-user` (the profile name), which otherwise trusts the cache.
- Signing out clears every app's cookies in this browser at once: `signOutEverywhere()` starts a redirect chain through each app's `/auth/signout` (write → grid → stage → landing → `/login`). Each hop signs out on its own origin and always expires the session and cache cookies, even with no valid session. The account page's "Sign out everywhere" and delete account finish through it too. It is a GET, so another site can sign a visitor out: accepted, nothing is exposed.
- Net effect: this browser is signed out of every app at once; another device loses write access immediately and read access within 5 minutes.

## Not doing, and when to revisit

- **Smart Placement.** The database is in EEUR; it only helps users far from Europe. Add `"placement": { "mode": "smart" }` when there are some.
- **Caching the account's file list in the browser.** Faster repeat loads, but it puts account files on disk on shared computers, which `sw.js` deliberately avoids.
- **One origin for the whole suite** (a custom domain with path or subdomain routing). This is the real ceiling: it would turn an app switch into a client-side navigation and remove the hand-off. Already listed under "Next" in `PLAN.md`.

## Verify

1. `pnpm typecheck`, `pnpm test`, `pnpm build`.
2. `pnpm dev`, then in a browser: sign up; switch Write → Grid → Stage and confirm each opens signed in with the nav visible at once; open a file and go back, confirming in the network panel that `getViewer` is not called again; sign out and confirm `/login` shows no flash when revisited signed in.
3. After the next deploy: `curl -I` on an `/assets/*.js` URL shows `immutable`.
