# Agent guide for the Torah Library Add-On

You (human or AI) are working on a Google Docs add-on. This file tells
you what this codebase is, what rules are not-negotiable, which traps
have already swallowed the previous wave of contributors, and where
the canonical documents live. **Read this first; re-read it before any
large change.** Re-read it before proposing any cross-cutting
refactor. The rules below are the accumulated cost of bugs that were
fixed more than once.

## What this codebase is

- A **Google Docs add-on** written in Google Apps Script (V8 runtime).
- Deployed via [`clasp`](https://developers.google.com/apps-script/guides/clasp)
  from `apps-script/`. `.clasp.json` pins `rootDir` to that directory.
- Tests run in Node 22 from the repo root via `npm test`. They load
  `.gs` source with `vm.runInThisContext` (not `require`) because `.gs`
  is not a Node module format.
- **Not** a web app, not a Node.js project, not a generic JavaScript
  library. Web-app assumptions (NPM deps, `require('./file.gs')`,
  ES modules, bundlers) do not apply.

## Hard rules (violating these has broken production)

1. **Never add a new top-level preference key without adding a default
   to the `SETTINGS` defaults block in `Code.gs` _and_ a migration
   entry in `apps-script/migrations.gs`.** Existing users upgrade in
   place; a new opt-in flag defaulting to `false` silently disables
   behavior they had before. This was the root cause of the divine-name
   substitution regression — see the [regression log](docs/regression-log.md).
2. **Never ship a feature behind an "opt-in" flag that defaults to
   disabled for existing users.** If a flag must exist, either default
   it to `true` or write an `onOpen`/bootstrap migration that flips it
   to `true` for anyone who already had the previous behavior. The
   CHANGELOG must call out the migration loudly.
3. **Never `require('../apps-script/*.gs')` from a Node test.** It
   won't resolve, and even if it did, the `.gs` global-scope semantics
   differ from CommonJS. Use the `vm.runInThisContext` pattern shown
   in `test/tests/attribution.test.js` or the `vm.createContext` +
   `loadAppsScriptFiles` pattern in `test/tests/hebrew-preferences.test.js`.
4. **Never store a credential in `PropertiesService`.** If ephemeral
   is sufficient, use `CacheService.getUserCache()` — the existing
   session-state helpers at `Code.gs:getSidebarSessionState` show the
   pattern. If persistent storage is genuinely required, it belongs
   server-side (i.e. not in the add-on), bound to a real account.
   See `docs/ai-lesson/DESIGN.md` for the longer argument.
5. **Never write `.innerHTML` without a one-line comment explaining
   why `textContent` won't do.** Every current `.innerHTML` assignment
   in `apps-script/**/*.html` has a justification comment on the line
   above; `pre_clasp_qc.sh` check 9 flags any new unannotated write.
   If you're adding one, either (a) refactor to `textContent` +
   `document.createElement`, or (b) add the justification comment
   next to the assignment explaining the static/escaped provenance
   of every interpolated value.
6. **Never add OAuth scopes without a PR-level justification** in
   the commit message. Scopes appear on the Marketplace consent screen
   and cannot be silently removed once users have approved them.
7. **Never pass `UserProperties` values, credentials, API keys, or
   raw user document text to `Logger.log`.** Existing call sites only
   log `error.message`, function names, and reference strings the
   user already entered — keep it that way. If you need to diagnose
   a bug, add a structured payload with known-safe fields, not a
   blanket dump.
7. **Never break an entry in `docs/rpc-surface.json`.** Every
   server-side function reachable from `google.script.run` is listed
   there with its arity. Renaming, removing, or changing arity without
   updating the snapshot is caught by `test/ui/rpc-surface.test.js`.
   If you really do need to change it, update the JSON in the same
   commit, add a row to `docs/regression-log.md`, and search the
   client HTML to update every caller.

## Known regression traps (anti-pattern catalog)

See [`docs/regression-log.md`](docs/regression-log.md) for the full
dated list. Short form of the worst offenders:

- **New opt-in flag without migration.** Causes silent upgrade
  regressions for every existing user. Always pair with a migration.
- **Dead global variable kept alive after a refactor.** The setter
  survives, every reader is gone (or vice versa). Always remove the
  producer and the consumer in the same commit.
- **Output-shape change without a snapshot test.** Line markers,
  newline handling, attribution block placement. The insertion path
  now has snapshot tests — don't "simplify" the formatting without
  updating them.
- **CSS-token drift.** Inline `<style>` blocks in entry templates
  (`sidebar.html`, `preferences.html`) duplicate values already in
  `apps-script/css/tokens.html`. The two copies drift. Always edit
  the token file, not the template's inline styles.
- **Client-side selector contracts not pinned.** `#voices-insert-mode`,
  `.voices-insert-options`, and similar DOM ids the server RPC relies
  on must be listed in `test/ui/contracts/selector-contracts.json`.
- **Server refactor renames a function the client calls.** The client
  does not fail loudly — `google.script.run.foo()` on a missing `foo`
  silently no-ops. `test/ui/rpc-surface.test.js` pins this.

## How to run tests locally

```bash
npm test
```

Expected: 30 passing, 0 failing. If anything is red, stop and fix it
before touching the feature you came to change. `npm test` runs:

- `test/tests/attribution.test.js` — attribution-line formatting.
- `test/tests/hebrew-preferences.test.js` — Hebrew display filters,
  divine-name replacements, transliteration, search payload shape.
- `test/ui/include-wiring.test.js` — every entry template pulls in
  the expected partials.
- `test/ui/js-contracts.test.js` — each JS partial defines the
  functions it claims to own.
- `test/ui/selector-contracts.test.js` — DOM ids the server RPC
  depends on still exist in the rendered HTML.
- `test/ui/template-snapshots.test.js` — byte-for-byte snapshots of
  the four entry templates. Update via `UPDATE_UI_SNAPSHOTS=1 npm test`.
- `test/ui/rpc-surface.test.js` — the server/client contract
  described in §Hard rules above.

## How to deploy

```bash
bash pre_clasp_qc.sh apps-script
clasp push   # from the repo root; .clasp.json pins rootDir=apps-script
```

The QC script must exit 0 before you push. It walks the nested tree
under `apps-script/` and checks basename collisions among `.gs` files
(they share one global scope at runtime), balanced `<style>/<script>`
tag counts, Node syntax of every extracted `<script>` body, duplicate
named-function definitions within one entry-template's include graph,
the presence of core search-wiring tokens, and orphan HTML files.

## What NOT to rewrite

These utilities are load-bearing, stable, and well-scoped. They have no
known bugs in the current branch. Rewriting them is explicitly
off-scope for any cleanup work:

- `apps-script/attribution.gs` — dual-mode (Apps Script + Node) pure
  helper; the Node test path depends on its exact shape.
- `apps-script/gematriya.gs` — pure helper; has callers in both
  transliteration and insertion paths.
- `apps-script/transliteration.gs` — self-contained transliteration
  engine with its own override map and biblical-Hebrew dagesh mode.
- The `include()` template pattern (`<?!= include('path/to/partial'); ?>`)
  — this is how Apps Script composes HTML and is the right pattern;
  don't introduce a bundler or a different composition scheme.
- The `CacheService.getUserCache()`-backed sidebar session state
  (`getSidebarSessionState` / `setSidebarSessionState` /
  `clearSidebarSessionState`) — correct, tested, and the primitive
  Route 3 of the AI design doc would reuse.

## Scope fence

This project is a Google Docs add-on for inserting Sefaria sources.
It is **not**:

- a "Review Schema,"
- a "canonical knowledge contract,"
- a "Living Library,"
- a "Commentary Builder,"
- a "GOLEM flow,"
- a "TooltipPayload / ProvenanceRecord / TextAnchor" consumer.

Those concepts belong to unrelated repositories and have already
polluted this one once — see the Stage 1 commit that scrubbed them.
If you or an upstream agent propose a change using that vocabulary,
reject it; the proposed change is almost certainly intended for a
different repo.

## Where everything lives

- `README.md` — user-facing project overview.
- `docs/CHANGELOG.md` — user-facing changes by release.
- `docs/architecture.md` — the server/client boundary, the include
  graph, the storage layers, the RPC surface.
- `docs/regression-log.md` — every bug that has regressed more than
  once, with the pinning test that now holds it down.
- `docs/rpc-surface.json` — frozen server-function surface.
- `docs/ai-lesson/DESIGN.md` — design notes for the detached AI
  feature (not shipped in v1).
- `reference/ai-lesson/` — preserved AI source files, excluded from
  `clasp push` via `.claspignore`.
- `test/tests/` — Node unit tests.
- `test/ui/` — contract / snapshot / wiring tests.
- `pre_clasp_qc.sh` — the last line of defense before `clasp push`.
