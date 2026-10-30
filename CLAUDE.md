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
  ES modules, bundlers) do not apply **to the add-on**: Apps Script has
  no module loader, and nothing under `apps-script/` may depend on a
  package.
- The one exception is the **test harness**. `linkedom` is a
  devDependency supplying the `DOMParser` that Node lacks, which the
  HTML-sanitizer tests need. It is test-only, never shipped (`clasp`
  pushes `rootDir: apps-script` and `node_modules/` is git-ignored), and
  the tests skip rather than fail when it is absent. Run `npm ci` before
  `npm test` on a fresh checkout. Adding a *second* dependency deserves
  the same scrutiny as the first.

## Hard rules (violating these has broken production)

1. **Never add a new top-level preference key without adding a default
   to the `getDefaultPreferences()` block in `apps-script/server/preferences.gs` _and_ a migration
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
   session-state helpers at
   `apps-script/server/preferences.gs:getSidebarSessionState` show the
   pattern. If persistent storage is genuinely required, it belongs
   server-side (i.e. not in the add-on), bound to a real account.
   See `docs/ai-lesson/DESIGN.md` for the longer argument.
5. **Never write `.innerHTML` without a one-line comment explaining
   why `textContent` won't do.** Every current `.innerHTML` assignment
   in `apps-script/**/*.html` has a justification comment on the line
   above; `pre_clasp_qc.sh` check 9 flags any new unannotated write,
   and check 9b does the same for jQuery `.html(...)`, which is the
   same sink.
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
8. **Never break an entry in `docs/rpc-surface.json`.** Every
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
- **Leaning on Google's stylesheet.** `add-ons.css` styles bare form controls
  with selectors that out-rank one class, and Google can change it at any
  time. It loads into a low-priority cascade layer. Base control styles live in
  `apps-script/shared/css/native-controls.html` (tokens at its top).
- **Client-side selector contracts not pinned.** `#voices-insert-mode`,
  `.voices-insert-options`, and similar DOM ids the server RPC relies
  on must be listed in `test/ui/contracts/selector-contracts.json`.
- **Server refactor renames a function the client calls.** The client
  does not fail loudly — `google.script.run.foo()` on a missing `foo`
  silently no-ops. `test/ui/rpc-surface.test.js` pins this.

## How to run tests locally

```bash
npm ci      # once per checkout; installs the test-only devDependency
npm test
```

Expected: **599 passing, 0 failing, 0 skipped**. A *skipped* count above
zero usually means `npm ci` has not been run and the sanitizer tests are
sitting out — treat that as red, not as a pass. If anything is red, stop
and fix it before touching the feature you came to change.

`npm test` runs, in `test/tests/`:

- `attribution.test.js` — attribution-line formatting.
- `hebrew-preferences.test.js` — Hebrew display filters, divine-name
  replacements, transliteration, search payload shape.
- `migrations.test.js` — the UserProperties schema migrations.
- `menu-layout.test.js` — the customizable add-on menu: default layout
  matches the pre-customization menu, Preferences and Help are always last,
  dividers collapse, stored layouts are normalized.
- `extended-gemara.test.js`, `format-data-for-pesukim.test.js` — the
  regressions named in `docs/regression-log.md`.
- `search-input-normalization.test.js` — query normalization, punctuation-blind
  title matching, the close-match suggester, and that as-you-type search never
  rewrites the search box.
- `non-insertable-results.test.js` — a book or section heading with no text
  of its own is never listed as a direct match; picking one anyway returns to
  the results (entry removed, nothing selected) after a short notice, unless the
  reader has already moved on.
- `citation-abbreviations.test.js` — traditional citation forms
  ("Hil. Shabbat 1:1").
- `linker-prefilter.test.js` — what leaves the machine, and offset
  mapping back onto the document.
- `linker-classify.test.js` — which citation becomes a link, a
  question, or a counted failure; Apply re-finds each citation by occurrence,
  so an edit while the dialog is open can't move a link.
- `linker-retry.test.js` — a citation Sefaria's linker can't match is looked
  up again with exactly the sidebar search's spellings, in its order; a hit
  is linked like any single match (and says which spelling found it); the
  rest reach the review dialog's "Not matched" list with the spellings tried
  and why each failed (with what Sefaria answered to each); no network while
  retrying never fails the scan. A label Sefaria's linker took into the
  citation ("Duplicate A: Genesis 2:1") is left out and the reference linked
  at its own place; a made-up book after a label stays unmatched.
- `linker-insert-replace.test.js` — Link Texts' Insert follows "Insert from
  Selection replaces the selection": a citation on its own line is replaced
  by the source (titled with it, link kept); one inside a sentence is kept.
  The review dialog's "Customize this insertion" overrides reach the insert
  and the fetch (vowels are stripped at fetch time), filtered by key and
  value, and are never stored.
- `sanitize-source-html.test.js` — the Sefaria-HTML allowlist sanitizer.
  linkedom cannot reproduce browser mutation XSS; verify sanitizer
  changes in headless Chromium as well.
- `set-preferences.test.js` — only `SETTINGS` keys can be written
  through the client-reachable preference setters.
- `triggers.test.js` — `onInstall` seeds preferences and then builds the
  menu; `onOpen` falls back to the default menu instead of ending with none.
- `source-attribution.test.js` — source credit on by default; the Hebrew
  edition and its license are credited.
- `divine-name-rules.test.js` — יה only as a whole word, replacement text
  used literally, punctuation kept when niqqud is stripped; a substitute keeps
  the name's vowels and cantillation (יְהוָ֥ה → יְיָ֥, אֱלֹהִ֑ים → אֱלוֹקִ֑ים;
  another word such as השם keeps the cantillation only), on insert and in
  Transform Divine Names.
- `typography-defaults.test.js` — "Match the document" fonts, the title
  heading style, and reading the style at the insertion point.
- `source-emphasis-mode.test.js` — the source's bold and italics: keep,
  discard, or "Bold only" (what it removes — plain text and italics alone —
  and what it keeps: bold italics, line markers, punctuation, paragraphs with
  no bold, and the whole Hebrew — it applies to the translation only).
- `multi-version-insert.test.js` — multi-translation insert: one title per
  block, blank-line separation, empty translations skipped, every block
  formatted like the first; HTML-entity decoding (`&thinsp;` and friends). With
  the Hebrew on top and Citation on, the Hebrew edition is credited once.
- `translation-language-typography.test.js` — per-language translation
  formatting: stored entries cleaned, the translation's language read from
  Sefaria's payload, and only that language's blocks reformatted.
- `sidebar-session-fetch.test.js` — the Layout tray's Vowels, Cantillation
  and Punctuation pills (sidebar session overrides) reach the fetched, and so
  the inserted, text; every sidebar fetch passes its session.
- `insertion-target.test.js` — where an insert goes: after the cursor's
  block, inside a table cell for paragraph layouts, below the table (with a
  notice) for side-by-side layouts, never into a header, footer or footnote.
- `sheet-insert.test.js` — a Voices (source sheet) insert: Both is the
  sheet's text under a title linked to the sheet, never the citation block on
  top of it; Citation leaves out a summary that only repeats the title.
- `insert-title.test.js` — a sidebar insert is titled with the text chosen
  (its ref), never with what was typed in the search box.
- `sefaria-unavailable.test.js` — "couldn't reach Sefaria" and a find-refs
  timeout throw, instead of reading as "no match" / "no citations".
- `punctuation.test.js` — the Hebrew and translation "Punctuation: Off"
  settings: what is stripped (sof pasuq, paseq, {פ}, maqaf → space) and kept
  (ר', רש"י, G-d, 3:16, tags, entities), the two toggles independent, refs
  untouched, and stripping before the divine-name substitutes.
- `transliteration-source.test.js` — the transliteration is read from the
  Hebrew as fetched (vowels kept, the Hebrew "Punctuation: Off" setting and
  divine names applied), never the vowel-stripped Hebrew;
  `aligned-rows.test.js` pins the insert side.
- `transliteration-style.test.js` — the Name and every substitute for it
  (יי, יקוק, ה', השם) read "HaShem", prefixes kept (laHaShem), IPA in IPA;
  each sentence (line, after sof pasuq or period) starts with a capital,
  except in IPA; no cantillation mark or meteg is left in the Latin text;
  names of people, places and peoples are capitalized (pointed spelling first,
  so עֵשָׂו but not עָשׂוּ; two-word names; Talmud sages with their titles and
  prefixes; a name that is also a word only after a title), and the generated
  pointed keys match `pointedKey_`; a maqaf is a plain hyphen.
- `aligned-rows.test.js` — the side-by-side "Line by line" setting: each
  verse paired with its translation in its own table row (numbering, spanning
  refs, missing segments, per-row transliteration); off keeps one row.
- `translation-availability.test.js` — a translation with no text for the
  passage is left out of the version list (greyed out with "Show unavailable
  translations"), languages hidden in Preferences → Search are left out, and a
  failed availability lookup hides nothing.
- `rich-text-markup.test.js` — Sefaria markup with any attributes (Shulchan
  Arukh's commentary anchors) inserts without throwing; a source with one
  language inserts that language alone, with its title's entities decoded.
- `first-run-setup.test.js` — first-run setup and the Simple / Full interface
  mode: clicking through with the preselected answers writes nothing, only
  values the dialog can produce are stored, switching to Simple and back
  returns the user's own menu, setup is shown once (never to an upgrader), and
  the dialog's preview transforms its sample exactly as an insert would.
- `title-link-and-fonts.test.js` — the source (Hebrew) title and the
  translation title each have their own link switch and font, linked or not;
  the linked style applies only with that title's "Hyperlink formatting
  override" on (schema v24 turns both on); a caller that passes only the old
  `insertSefariaLink` links both alike, as before; schema v23 copies the old
  values (`migrations.test.js`).
- `sidebar-session-saves.test.js` — the sidebar's session saves go one at a
  time (a quick second click once overwrote the first: the lost Vowels
  choice), switches re-draw only when nothing is left to save, and a change
  the fetch applies re-fetches once, with Add Source disabled meanwhile. A
  change made before the bootstrap gives the sidebar its session is kept.
- `citation-style.test.js` — the citation under a source has its own style
  (Preferences → Fonts → Citation); its defaults and schema v25 keep the old
  8 pt italic in the font of the text above.
- `storage-reads.test.js` — each preference reader reads UserProperties once
  (`snapshotProperties_`): a Link Texts rerun is ~4 reads, not ~310; a scan
  whose settings can't be read says nothing was scanned or changed.
- `session-library-handoff.test.js` — the Session Library dialog's changes
  reach the sidebar: Done stays open if they can't be saved, the sidebar backs
  off for an hour and says so when it can't read them, Library always reopens;
  opening it deletes a copy an earlier version left in UserProperties.
- `sidebar-recovery.test.js` — a failed sidebar bootstrap is retried once,
  then reported (the Insertion Options card is not wired up without it);
  Link Texts from the sidebar shows it is opening and says why it couldn't.
- `divine-name-mapping-label.test.js` — a saved divine-name replacement,
  custom or preset, reopens under its own label (all four rules, linkedom).
- `transform-scope.test.js` — Transform Divine Names asks first, naming its
  scope (the open tab's body, not the selection; not headers, footers,
  footnotes or other tabs) and the rules, and says how many it replaced.
- `preview-emphasis.test.js` — the sidebar preview shows Drop and Bold only as
  the insert writes them: the real server pipeline and the preview's mirrors
  give the same words and bold.
- `lexicon-stale-response.test.js` — a Lexicon or Voices answer to an earlier
  search is dropped (the stale "No lexicon entries found for 'Genesis 1:1'").
- `hebrew-fonts.test.js` — Hebrew marks a font has no glyph for (David Libre's
  cantillation) are set in Noto Serif / Sans Hebrew at insert, and only those:
  letters and the marks it has stay; "Match the document" judges the
  document's font; it is always on (`hebrew_mark_fallback` is retired, schema
  v22 deletes it, and a stale stored `false` changes nothing); the
  preview plans exactly what the insert does, from the same generated table.

and in `test/ui/`:

- `include-wiring.test.js` — every entry template pulls in the expected
  partials.
- `js-contracts.test.js` — each JS partial defines the functions it
  claims to own.
- `selector-contracts.test.js` — DOM ids the server RPC depends on
  still exist in the rendered HTML.
- `template-snapshots.test.js` — byte-for-byte snapshots of the entry
  templates (including `linker-results.html`). Update via `UPDATE_UI_SNAPSHOTS=1 npm test`, and **never**
  by hand-editing a `.snap` file.
- `rpc-surface.test.js` — the server/client contract described in
  §Hard rules above.
- `linker-dialog.test.js` — the Link Texts dialog shows one state at a
  time, has separate Link / Insert columns, and the Linking prefs tab; its
  "Customize this insertion" panel is the shared insertion options, sends
  its settings with each insert, and saves only on "Save as defaults".
- `version-manifest.test.js` — `docs/VERSION.json` against the schema
  version, the migrations that must exist for it, and every surface that
  shows a version string.
- `embedded-json.test.js` — server data force-printed into an inline
  `<script>` goes through `toEmbeddedJson_`.
- `csp-coverage.test.js` — every entry page carries the same
  Content-Security-Policy.
- `vowels-tanakh-only.test.js` — the composition card's three-way Vowels
  (Off / Tanakh / On) and Cantillation (Off / Tanakh / Torah) controls write
  the stored pairs the server reads, in every host.
- `insertion-options.test.js` — the Layout pickers exist once
  (`shared/insertion-options`): every host (sidebar, Preferences, Link Texts
  dialog) includes and initialises them, and no page has its own copy of the
  cards or their CSS.
- `native-controls.test.js` — Google's `add-ons.css` loads only into the
  `google-addons` cascade layer, every page with `shared/ui/head` includes
  `shared/css/native-controls`, and every `<input type>` in use has a base rule
  there. Style a control in its component file or in that file, never by
  relying on Google's sheet.
- `simple-mode.test.js` — Simple mode hides with CSS only (never removes),
  hides only the search tools in the sidebar (no "More options"), the footer
  is Add Source, Insertion Options, then Session Library / Quick Actions /
  Preferences in both modes, Preferences' "Show advanced settings" brings back
  what it hides, and the server tells each page its mode. Opening Preferences
  from the sidebar shows "Opening Preferences…" and ignores repeat clicks.
- `font-pickers.test.js` — every composition-card host has the font buttons
  and loads `shared/fonts` first; Preferences' font lists come from that one
  list; fonts Docs does not have (SBL Hebrew, Ezra SIL) are never offered;
  no font UI mentions borrowed marks (Help does).
- `insertion-options-refresh.test.js` — the Insertion Options tray scrolls
  (its end, the transliteration Style, was cut off in Translation and Both),
  a fetch-time change shows "Updating preview…" at once, every Preferences save
  reaches an open sidebar, and the card's transliteration sample drops the
  maqaf with Hebrew punctuation off.
- `translation-version-select.test.js` — the sidebar's version lists: the
  translation list is never reached by the class the Source editions list
  shares, a click in a multi-select list toggles one translation, a re-render
  of the same passage keeps the multi-selection, neither list can be left
  empty, the filter box never changes the selection, and a list that isn't
  focused still shows what is selected.
- `server-completeness.test.js`, `sidebar-bootstrap-shape.test.js`.

## How to deploy

```bash
bash pre_clasp_qc.sh apps-script
npm ci --prefix tools/clasp --ignore-scripts   # once; pinned clasp, see tools/clasp/README.md
npx --prefix tools/clasp clasp push   # from the repo root; .clasp.json pins rootDir=apps-script
```

`clasp push` (and the deploy workflow on `master`) only replaces the script
project's HEAD, which you test through Apps Script → Deploy → Test
deployments. **It does not reach Marketplace users.** They run the numbered
version set in Marketplace SDK → App Configuration. To release: run the live
test checklist against HEAD, `clasp version "v<version>"`, then set that
version number in the SDK and save; users get it on their next document open.

The deploy workflow pushes to the project named by the repository variable
`CLASP_SCRIPT_ID` (with the `CLASP_TOKEN` secret), not to the `scriptId` in
`.clasp.json`, and is skipped in any repository that has not set it. Don't
hard-code a repository or script ID into the workflow — the same code is
deployed from more than one repository.

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
- `docs/PRIVACY.md`, `docs/TERMS.md` — the policies the Marketplace listing
  links to. `PRIVACY.md` §2.2 lists every host the add-on's pages load from.
- `docs/marketplace-listing.md` — the store console package: every console
  field, the listing copy, and the release procedure.
- `docs/architecture.md` — the server/client boundary, the include
  graph, the storage layers, the RPC surface.
- `docs/VERSION.json` — the single source of truth for the version and
  the preference-schema number. Enforced by
  `test/ui/version-manifest.test.js`.
- `docs/versioning.md` — what bumps what, and the one coupling that
  matters: a new preference key needs a default, a migration, a schema
  bump, a manifest bump and a version bump, all in one commit.
- `docs/regression-log.md` — every bug that has regressed more than
  once, with the pinning test that now holds it down.
- `docs/rpc-surface.json` — frozen server-function surface.
- `tools/hebrew-font-coverage/` — generates the table of which Hebrew marks
  each font lacks (`server/hebrew-font-coverage.gs`, `shared/fonts/coverage.html`)
  from the font files. Never hand-edit those two; re-run the generator.
- `tools/proper-names/` — generates `server/proper-names.gs`, the names the
  transliteration capitalizes, from STEPBible's tagged Tanakh (CC BY 4.0) and
  `talmud-names.txt`. Never hand-edit the `.gs`; add a Talmud name to the
  `.txt` and re-run the generator.
- `docs/ai-lesson/DESIGN.md` — design notes for the detached AI
  feature (not shipped in v1).
- `reference/ai-lesson/` — preserved AI source files, excluded from
  `clasp push` via `.claspignore`.
- `test/tests/` — Node unit tests.
- `test/ui/` — contract / snapshot / wiring tests.
- `pre_clasp_qc.sh` — the last line of defense before `clasp push`.
