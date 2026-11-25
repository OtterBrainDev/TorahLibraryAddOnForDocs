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
  and the `css/` tokens and components. Its three search tabs share one
  workflow, `sidebar/js/search-tabs` (see *The search tabs* below); each tab's
  own code is in `search-controller` (Texts), `voices` and `lexicon`.
- **`preferences.html`** — preferences dialog. Composes `preferences/css`,
  `preferences/js` and `preferences/settings-file-js` (the Advanced tab's
  settings file, which reaches the dialog through `window.PreferencesDialog`).
- **`surprise-me.html`** — "surprise me" random-text dialog: the shared
  `shared/surprise-me` form, the same as the sidebar's Experimental card.
- **`linker-results.html`** — the Link Texts review dialog. A template
  (`createTemplateFromFile`, not a plain file) so its "Customize this
  insertion" panel can include the shared insertion options below.
- **`first-run-setup.html`** — first-run setup, shown once to a new user
  (`server/first-run.gs`). Composes `first-run-setup/css` and
  `first-run-setup/js`. See `docs/first-run-setup-design.md`.
- **`help-modal.html`**, **`feedback-modal.html`**,
  **`session-library-modal.html`**, **`gematriya-count.html`**,
  **`release-notes.html`** — standalone modal dialogs, each its own scope.

### Native form controls and Google's stylesheet

`shared/ui/head` loads Google's add-on stylesheet (`add-ons.css`) into the
cascade layer `google-addons`, and declares the layer order
`google-addons, native-controls`. `shared/css/native-controls` (included
right after the head by every templated page) is layer `native-controls`:
the base look of `select`, `option`, text-like `input`s, `textarea`,
checkboxes, radios, colour pickers and `button`, from the `--control-*`
tokens at its top. Component CSS is unlayered, so it beats both layers
whatever its specificity. A component sets only what it wants to differ.
`test/ui/native-controls.test.js` pins the layering, the include and a base
rule for every `<input type>` the add-on uses. `release-notes.html` imports
the sheet the same way. `help-modal.html`, `feedback-modal.html` and
`gematriya-count.html` don't load Google's sheet and style their few
controls inline.

## Server files

- `apps-script/server/*.gs` — server logic, one file per domain.
  All `.gs` files share one global scope at runtime, so the split is
  organizational; `pre_clasp_qc.sh` rejects basename collisions.
  - `menu.gs`, `menu-layout.gs` — the add-on menu (customizable from
    Preferences → Menu Bar), sidebar bootstrap, and dialog launchers.
  - `first-run.gs` — first-run setup and the Simple / Full interface mode
    (`ui_mode`), including the Simple menu and switching between modes, and
    Reset To Defaults (which resets the menu to the one for the mode).
  - `settings-file.gs` — Preferences → Advanced's settings file: export the
    settings as JSON, preview and apply an import (only `SETTINGS` keys with
    valid values; a file's interface mode goes through `applyUiModeSwitch_`).
  - `settings-profiles.gs` — settings profiles: named sets of the Text and
    layout / Fonts settings, switched from Everything's Preferences or the
    sidebar (see Storage layers).
  - `preferences.gs` — the `SETTINGS` list, `getDefaultPreferences()`,
    account preferences (`UserProperties`) and sidebar session state
    (`CacheService`).
  - `sefaria-fetch.gs`, `search.gs`, `lexicon.gs`, `sheets.gs` — calls
    to Sefaria's API (texts, search, dictionary, source sheets).
  - `insertion.gs` — writing sources into the document, including
    typography, attribution and multi-translation inserts.
  - `transliterated-title.gs` — the title of the transliteration's own
    column: Sefaria's Latin title for the Hebrew one (picked from its
    unmarked list by matching the Hebrew consonants), else the Hebrew title
    transliterated from a pointed spelling, else the Latin reference.
  - `document-actions.gs` — Link Texts with Sefaria, Transform Divine
    Names, Insert Source from Selection, Unlink.
  - `linker-prefilter.gs`, `citation-abbreviations.gs` — the local
    citation scan that limits what the linker uploads, and traditional
    citation forms.
  - `text-processing.gs` — Hebrew display filters and divine-name
    replacement.
  - `utils.gs` — small shared helpers.
- `apps-script/triggers.gs` — the `onInstall` / `onOpen` simple
  triggers. Kept at the project root deliberately (see its header).
- The AI lesson feature (formerly `AiLessonGateway.gs`) is detached:
  its source is preserved under `reference/ai-lesson/`, which is not
  pushed, and its sidebar UI on the OtterBrainDev `ai-shiur` branch.
- `apps-script/attribution.gs` — dual-mode (server + Node test) pure
  helper for English translation attribution lines.
- `apps-script/gematriya.gs` — gematriya numerals.
- `apps-script/transliteration.gs` — Hebrew-to-Latin transliteration.
- `apps-script/surprise-me-feature.gs` — "surprise me" handler.
- `apps-script/config.gs` — `DEV_FLAGS` object.
- `apps-script/ui_core.gs` — shared UI-side helpers.
- `apps-script/migrations.gs` — (added Stage 2) preferences schema
  migration on `onOpen`.

## Sefaria text boundary

`server/sefaria-fetch.gs` reads passage content through Texts v3, resolves
reference bounds through `/api/ref/`, and uses the Versions catalog for exact
edition/language-family requests. Its adapter retains the internal `he` /
`text` and edition metadata contract before display filters run. A bilingual
publication may give both roles the same title; identity includes the edition's
language/role, not the title alone. Link Texts'
batch recovery uses the same metadata planner and response normalizer, with
bounded traversal and response-identity checks. Other Sefaria operations
keep their current routes. See [the migration handoff](sefaria-api-migration.md)
for the endpoint inventory, deliberate no-fill policy and validation boundary.

## Source commentary and notes

`server/source-text.gs` owns semantic note extraction and exact-edition
commentary profiles. `tools/sync-source-text.js` generates the identical
client implementation at `shared/source-text.html`. Both preview and
insertion use it. It emits escaped text and a fixed set of formatting tags;
the existing allowlist sanitizer for other rich-content surfaces is unchanged.
Image descriptions are plain text in both outputs; images and their URLs are
never emitted or fetched by this processor.
Notes are recognized by Sefaria's classes before commentary filtering, so a
bold footnote lemma cannot erase unbold translation words. `source_notes_mode`
(schema 32) controls Omit, Inline or a labelled Notes section. It applies to
both source and translation; Separate creates text, not native Docs footnotes.

Commentary profiles are bounded by exact edition, language and corpus:
William Davidson English Bavli uses bold base text; Silverstein's Rashi
Chumash and Rashi Ketuvim use bracketed additions. Unknown conventions
preserve text and source emphasis. Brackets are processed per original segment,
with nested brackets supported and malformed segments preserved whole.
The [handoff](sefaria-api-migration.md) records the primary-source evidence.

Sidebar option refreshes carry the selected translation and source edition,
including ordered multiple translations. A callback rechecks its request
ownership after rebuilding the preview; a newer edition request must not be
overwritten by an older response. The missing-edition guard keeps insertion
disabled until the editions required by Display have matching text. An unused
role cannot block single-language output; switching to Both revalidates its
required editions before making a previous partial reply insertable.

## The search tabs

Texts, Voices and Lexicon declare themselves in `SEARCH_TABS`
(`sidebar/js/search-tabs`): how the tab searches, which text it suits, how
many results a search found, what its selection holds, what a pin of one of
its results keeps (the Session Library entry, with its `mode`) and how that
result is found again. The shared part:

- A search is a **run** (`createSearchRun`) with its own results
  (`queryState`), corpus filter state (`resultPostProcessState`), hint and
  loading flag. A tab has one current run; an answer for a run its tab has
  replaced is dropped (`isCurrentSearchRun`, BUG-005).
- Only the **shown** tab's run is drawn: its two objects *are* the globals
  `queryState` and `resultPostProcessState`. A run in a hidden tab is processed
  by the same `computeResultPostProcessing(mode, …)` (no DOM), with that tab's
  preferences, so its badge count is right.
- **Switching tabs never searches.** `setSidebarMode` calls `stashSearchTab`
  (keeps the selection with the run) and `showSearchTab` (draws the tab's run
  if it is for the text in the box, else offers to search it). The Texts
  preview, versions and source card are left in the DOM while another tab is
  shown (`resetSelectedResultView` clears them only in Texts), and fetched
  again on return only if something changed meanwhile (`textsPreviewStale`).
- **Enter** searches the shown tab and, in the background, every other tab
  that suits the text and has no run for it (`prefetchOtherSearchTabs`);
  typing searches the shown tab only.
- A tab's "corpora" are Texts' corpora, Voices' topic categories
  (`VOICES_TOPIC_CATALOG`) and the Lexicon's dictionaries
  (`LEXICON_DICTIONARY_CATALOG`), each with a saved order and exclusions;
  `getPreferenceCorpusOrder` / `getPreferenceExcludedCorpora` take the tab.
- A Session Library entry reopens in its own tab (`openSessionEntry`): the
  search that finds it runs there, and the entry is selected when that run
  answers (`run.openEntry`), never after a delay.

`test/tests/search-tabs.test.js`, `voices-topics.test.js` and
`session-pins.test.js` run the real partials through
`test/tests/helpers/sidebar-search-harness.js`.

## Storage layers

1. **`UserProperties`** (account-scoped, persistent). Holds every
   user preference listed in the `SETTINGS` array in
   `server/preferences.gs` — fonts,
   filters, divine-name replacement choices, display mode defaults.
   Migrations live in `apps-script/migrations.gs` and run on `onOpen`
   and first sidebar load, keyed by `prefs_schema_version`.
   Settings profiles (`server/settings-profiles.gs`) live here too, outside
   `SETTINGS`: `settings_profiles` is the index (names, and which is in
   use), and `settings_profile_<id>` a snapshot of each profile *not* in use.
   The profile in use is the ordinary stored preferences, which every reader
   reads as before; a switch keeps the outgoing values and writes the incoming
   ones in one `setProperties`. A snapshot records its schema and is brought
   forward through `applyMigrationsFrom_` when it comes back, so a migration
   must work on any getProperty / setProperty / deleteProperty store.
2. **`CacheService.getUserCache()`** (ephemeral, 6h max TTL). Holds
   per-session sidebar state — the in-progress selected result,
   temporary preference overrides, session-library entries. Accessed
   via `getSidebarSessionState` / `setSidebarSessionState` /
   `clearSidebarSessionState` (`server/preferences.gs`). This is the primitive a
   future AI-key Route-3 flow would reuse.
3. **`Script Properties`** — not used. (They held the AI gateway's
   shared secret before that feature was detached.) The add-on stores no
   credential anywhere; see hard rule #4 in `CLAUDE.md`.

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
template (head, api, feedback, state, dom, core-shared). The insertion
options are shared by more than one entry, so they live under `shared/`
too and know nothing about their host:

- `shared/composition-card/*` — linked title, then a Source section
  (vowels, cantillation, Hebrew punctuation, font, transliteration) and a
  Translation section (punctuation, Commentary, font), each a `<details>` that folds
  to a summary line; `openSections` in `data-cc-features` opens them
  (Preferences). `initCompositionCard` also drives the Line #s and Citation
  pills, which sit in the insertion options' row by id. Sidebar, Preferences
  and the Link Texts dialog.
- `shared/insertion-options/*` — the Display and Layout pickers, and the row
  under them with Line by line, Line #s and Citation, followed by Notes
  (`initInsertionOptions`). It also hides the card's transliteration Position
  where it doesn't apply, and its Arrangement icons sketch the
  transliteration's place and Line by line (`getState().transliterationOn` /
  `transliterationPosition`; the card calls `updateInsertionOptions` after
  each update). The sidebar's Layout tray, the Link Texts
  dialog's "Customize this insertion" panel, and Preferences. Each host
  passes its own state (`getState`) and decides what a choice does
  (`onSelectDisplay`, `onSelectLayout`): the sidebar saves it, the dialog
  keeps it for one pass, Preferences writes it into the form. Preferences
  sets `expanded: true` (both pickers open and labelled, no dropdowns) and
  `hideInapplicable: false` (every default stays editable).
  `test/ui/insertion-options.test.js` fails if a page grows its own copy of
  the cards, their CSS, or their wiring.
- `shared/surprise-me/*` — the Surprise Me form (`initSurpriseMeForm`), in
  the sidebar's Experimental section and the Surprise Me dialog, which adds
  Cancel. `test/ui/surprise-me-shared.test.js` fails if either grows fields
  of its own.
- `shared/ui/busy-overlay` — `modalBusyShow` / `modalBusyHide`: the dialogs'
  spinner overlay while a save runs (Preferences, Link Texts, first-run
  setup), in the sidebar busy overlay's colours.
- `.cc-card--stacked` (composition card CSS) — the card's single centred
  column for narrow hosts (sidebar tray, Link Texts dialog).
- `shared/fonts/*` — every font list (`populateFontSelect`) and the
  composition card's font buttons (its `fonts` feature). `coverage.html` is
  generated by `tools/hebrew-font-coverage/` from the font files: which Hebrew
  marks each Google Font lacks. `js.html` plans the preview with the same rule
  the insert uses (`server/hebrew-fonts.gs`: only the marks a font lacks are set
  in Noto Serif / Sans Hebrew), so the preview shows what the document will.
  `test/tests/hebrew-fonts.test.js` holds the two planners together.

Because `include()` returns a partial's raw content, a partial cannot include
another: a host includes `shared/insertion-options/markup` and
`shared/composition-card/markup` side by side, in the container it passes as
`root`. Everything else is specific to one entry — `sidebar/js/*` is only reachable from
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
