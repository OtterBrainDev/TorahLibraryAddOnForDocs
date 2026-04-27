# Architecture

This is a short map of the server/client boundary, the include graph,
the storage layers, and the RPC surface. It is deliberately under
1,000 words. If you need more detail, the source is small; read it.

## System shape

```
                                   Google Docs
                                        │
                                        ▼
              ┌─────────────────────────────────────────────┐
              │         Google Apps Script runtime          │
              │  apps-script/*.gs     (server; V8 runtime)  │
              │  ────────────────                           │
              │   onOpen, menu triggers, google.script.run  │
              │   targets, Sefaria API calls, document      │
              │   mutation, UserProperties / CacheService   │
              │   IO, HtmlService.createTemplateFromFile()  │
              └──────────────┬─────────────┬────────────────┘
                             │             │
                HtmlService  │             │  google.script.run
                (server-side │             │  (client → server RPC)
                 templating) │             │
                             ▼             │
              ┌──────────────────────────┐ │
              │     Browser document     │ │
              │  (sidebar / dialog DOM)  │ │
              │                          │ │
              │ apps-script/*.html       │◄┘
              │ composed via `include()` │
              │ templates into one of:   │
              │  sidebar.html            │
              │  preferences.html        │
              │  ai_lesson.html          │
              │  surprise-me.html        │
              │  help-modal.html         │
              │  feedback-modal.html     │
              │  session-library-modal.html
              │  gematriya-count.html    │
              │  release-notes.html      │
              └──────────────────────────┘
```

## Entry templates (top-level `HtmlService` outputs)

Each of these is its own `HtmlService.createTemplateFromFile(...)` call
and produces an independent DOM. Script bodies in the HTML partials
that one entry includes are co-resident in that entry's window scope,
but not with another entry's. This matters for the duplicate-function
QC check (see `pre_clasp_qc.sh` step 6).

- **`sidebar.html`** — the main sidebar; most functionality lives here.
  Composes most of `sidebar/js/*.html`, the `shared/ui/*` partials,
  and the `css/` tokens and components.
- **`preferences.html`** — preferences dialog. Composes `preferences/css`
  and `preferences/js`.
- **`ai_lesson.html`** — AI lesson generator dialog (scheduled for
  detachment in Stage 4; will be preserved under `reference/ai-lesson/`
  rather than shipped).
- **`surprise-me.html`** — "surprise me" random-text dialog.
- **`help-modal.html`**, **`feedback-modal.html`**,
  **`session-library-modal.html`**, **`gematriya-count.html`**,
  **`release-notes.html`** — standalone modal dialogs, each its own
  scope.

## Server files

- `apps-script/Code.gs` — the main server file. Menu, preferences,
  Sefaria fetching, document insertion, text processing, sidebar
  bootstrap. Scheduled to be split across `apps-script/server/*.gs`
  in Stage 3.
- `apps-script/AiLessonGateway.gs` — signed-HMAC gateway for the
  Merkaz AI endpoint. Scheduled for detachment in Stage 4.
- `apps-script/attribution.gs` — dual-mode (server + Node test) pure
  helper for English translation attribution lines.
- `apps-script/gematriya.gs` — gematriya numerals.
- `apps-script/transliteration.gs` — Hebrew-to-Latin transliteration.
- `apps-script/surprise-me-feature.gs` — "surprise me" handler.
- `apps-script/config.gs` — `DEV_FLAGS` object.
- `apps-script/ui_core.gs` — shared UI-side helpers.
- `apps-script/migrations.gs` — (added Stage 2) preferences schema
  migration on `onOpen`.

## Storage layers

1. **`UserProperties`** (account-scoped, persistent). Holds every
   user preference listed in the `SETTINGS` array in `Code.gs` — fonts,
   filters, divine-name replacement choices, display mode defaults.
   Migrations live in `apps-script/migrations.gs` and run on `onOpen`
   and first sidebar load, keyed by `prefs_schema_version`.
2. **`CacheService.getUserCache()`** (ephemeral, 6h max TTL). Holds
   per-session sidebar state — the in-progress selected result,
   temporary preference overrides, session-library entries. Accessed
   via `getSidebarSessionState` / `setSidebarSessionState` /
   `clearSidebarSessionState` (`Code.gs`). This is the primitive a
   future AI-key Route-3 flow would reuse.
3. **`Script Properties`** (deployment-scoped, persistent, admin-only).
   Holds the Merkaz gateway shared secret, base URL, and cooldown
   tuning. Never read from a client-exposed function.

## RPC surface (client → server)

Every server function reachable via `google.script.run` is listed in
`docs/rpc-surface.json` with its arity and defining file.
`test/ui/rpc-surface.test.js` fails if:

- a listed function is renamed, removed, or has its arity changed
  without updating the snapshot;
- the client calls a server function that is neither listed nor on the
  `_knownBrokenCalls` allowlist.

Changing the RPC surface requires updating the JSON in the same commit,
adding a row to `docs/regression-log.md`, and walking every caller.

## Include graph

An HTML partial is pulled into an entry template by a scriptlet of the
form `<?!= include('path/to/partial'); ?>`. The `include()` function
is a thin wrapper over `HtmlService.createHtmlOutputFromFile`. Paths
are relative to the clasp root (`apps-script/`), minus the `.html`
suffix.

Where paths join: `shared/ui/*` partials are included by every entry
template (head, api, feedback, state, dom, core-shared). Everything
else is specific to one entry — `sidebar/js/*` is only reachable from
`sidebar.html`, `preferences/*` only from `preferences.html`, etc.
`pre_clasp_qc.sh` step 6 uses this graph to distinguish real
function-name collisions from false positives (same name in two
entries that never co-exist).

## The "don't silently diverge" guardrails

- `docs/rpc-surface.json` + `test/ui/rpc-surface.test.js` — server
  side of the client/server contract.
- `test/ui/contracts/sidebar-bootstrap.schema.json` +
  `test/ui/sidebar-bootstrap-shape.test.js` — shape contract for the
  object `getSidebarBootstrapData` returns. The sidebar also validates
  the shape at load time and logs a structured `console.warn` on
  mismatch (`apps-script/sidebar/js/bootstrap.html`).
- `test/ui/contracts/selector-contracts.json` +
  `test/ui/selector-contracts.test.js` — the DOM ids and classes the
  server RPC depends on.
- `test/ui/contracts/js-contracts.json` +
  `test/ui/js-contracts.test.js` — each JS partial defines the
  functions it claims to own.
- `test/ui/contracts/include-wiring.contract.json` +
  `test/ui/include-wiring.test.js` — each entry template pulls in its
  expected partials.
- `test/ui/snapshots/*.snap` + `test/ui/template-snapshots.test.js` —
  byte-for-byte snapshots of the four active entry templates.
- `pre_clasp_qc.sh` — basename collisions among `.gs` files, balanced
  tag counts, Node syntax check of extracted `<script>` bodies,
  duplicate named functions within one entry's include closure, core
  search-wiring tokens, orphan HTML files.

If you're about to change something that one of these guardrails
covers, update the guardrail in the same commit. If a guardrail is
in the way, ask whether the change is really correct before disabling
the guardrail. These exist because the same bugs have landed more
than once.

## Follow-up: full Code.gs domain split

The cleanup plan called for splitting `Code.gs` into per-domain files
under `apps-script/server/*.gs` (menu / preferences / sefaria-fetch /
text-processing / insertion / search / sheets). After Stage 4 removes
the ~700-line AI block, `Code.gs` will be roughly 2,700 lines and the
pressure to split drops significantly. The preferences-domain
functions are scattered across multiple disjoint blocks (see git-blame
or the list starting near `function onInstall` on line 98 and the
cluster from `function getDefaultPreferences` around line 1424
onward), so a clean split requires real surgery.

This split is deferred to a later pass. It is purely a structural
refactor — no behavior change — so the guardrails above will catch any
misstep when it does happen. When picking it up:

1. Move one domain at a time, each in its own commit.
2. Start with the most self-contained: `text-processing.gs` (divine
   names, Hebrew display, formatDataForPesukim, formatting helpers).
3. Verify `npm test` and `bash pre_clasp_qc.sh apps-script` after each
   domain move; never batch two together.
4. Watch for hidden dependencies on execution order of top-level
   declarations (only `SETTINGS` in this file, at line 35).
