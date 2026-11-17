# Agent guide for the Torah Library Add-On

You (human or AI) are working on a Google Docs add-on. This file tells
you what this codebase is, what rules are not-negotiable, which traps
have already swallowed the previous wave of contributors, and where
the canonical documents live. **Read this first; re-read it before any
large change.** Re-read it before proposing any cross-cutting
refactor. The rules below are the accumulated cost of bugs that were
fixed more than once.

This guide exists twice, as `CLAUDE.md` and `AGENTS.md`, so that agents
reading either file get it. The two are identical: change one, then copy it
over the other (`cp CLAUDE.md AGENTS.md`) in the same commit.
`test/ui/agent-guides.test.js` fails if they differ. (They drifted once:
AGENTS.md still expected 248 passing tests.)

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

## Versions: keep them in sync

The add-on is on the **2.0 line**: every release is the next build, 2.0.1,
2.0.2, 2.0.3, whatever it contains. Never write a 2.1 or a 3.0 for this
add-on: leaving the 2.0 line is the maintainers' decision, not a release
step (`docs/versioning.md` §1).

The number is decided in one place, `docs/VERSION.json`. Every other copy
follows it:

| Where | What it says | Kept in sync by |
| --- | --- | --- |
| `docs/VERSION.json` | `version`, `previous`, `status`, `released`, `prefsSchemaVersion` | — (the source) |
| Its `surfaces`: Help → About and the release notes | `Version 2.0.1` and *New in 2.0.1*: the full version, build included | `test/ui/version-manifest.test.js` |
| Its `docs`: the walkthroughs, the Google Docs walkthrough, the store listing's release steps | the version under demo or test (with the schema, where it is named), the current live test checklist, and `v2.0.1` in the release commands | `test/ui/version-manifest.test.js` |
| `docs/CHANGELOG.md` | `## Unreleased` until release, then a `## v<version> — … (date)` heading | `test/ui/version-manifest.test.js`, once `status` is `released` |
| `docs/live-test-checklist-<version>.md` | the release's live test checklist, named for it | by hand |
| Outside the repository | `clasp version "v<version>"` and the git tag `v<version>` | by hand |

- **Change them all in one commit, the release commit** (`docs/versioning.md`
  §4). Never move the version as a side effect of other work; if a change
  needs a release, say so in your summary instead.
- **A new place that shows the version goes into `surfaces` (user-facing,
  under `apps-script/`) or `docs` (anything else) in `VERSION.json`, in the
  same commit, or it isn't written.** The test can only protect the copies
  it is told about.
- **`prefsSchemaVersion` moves on its own clock:** with every migration, in
  that migration's commit (hard rule 1). The version moves at release. A
  listed copy that names both (`2.0.1, schema 30`) is checked for both.
- **Dated records keep their number:** a CHANGELOG heading, a past release's
  live test checklist, a design doc's target. Don't list them, and don't
  rewrite them at the next release.
- **Before committing a version change, look for stragglers:**
  `git grep -nE "\bv?2\.[0-9]+\.[0-9]+\b" -- ':!*package-lock.json'`. Every
  hit is the new version, a dated record, or not the add-on's version at all.

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

Expected: **813 passing, 0 failing, 0 skipped**. A *skipped* count above
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
  dividers collapse, stored layouts are normalized; the Menu Bar's labelled
  *Move to Quick Actions ▸* / *◂ Move to main menu* move an item into the
  submenu (its end; a hidden or emptied submenu comes back) or out (just
  below Quick Actions).
- `settings-file.test.js` — Preferences → Advanced's settings file: an
  export holds settings only (with the dialog's unsaved values) and round
  trips; an import writes only `SETTINGS` keys with valid values, only the
  parts ticked and only what differs, refuses foreign, broken or newer files,
  and takes a file's interface mode through the Interface switch; Reset To
  Defaults leaves one menu, the one for the interface in use.
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
- `source-emphasis-mode.test.js` — the translation's Commentary choice:
  Default (`keep`), Combine (`discard`: the bold goes, the italics stays) or
  Drop (`only`, once "Bold only": the text that is not bold goes; what it
  keeps: line markers, punctuation, paragraphs with no bold, and the whole
  Hebrew — it applies to the translation only). Only bold decides what is
  commentary; italics (foreign and transliterated words) is kept on whatever
  text is kept, in every mode. Each card label is pinned to its value, since
  "Drop" used to mean `discard`.
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
- `line-numbers-choice.test.js` — the Line numbers switch reaches Add Source
  as the reader left it: a preview never turns it on for a verse range (a
  Tanakh range was numbered with the switch off) or off for a single verse.
- `surprise-me-insert.test.js` — Surprise Me inserts each source with the
  saved Insertion defaults, the options Insert from Selection uses (Line
  numbers, output, arrangement, links, citation, transliteration), reading
  the preferences once; it once passed none, so every source was numbered
  and side by side.
- `insertion-target.test.js` — where an insert goes: after the cursor's
  block, inside a table cell for paragraph layouts, below the table (with a
  notice) for side-by-side layouts, never into a header, footer or footnote.
- `sheet-insert.test.js` — a Voices (source sheet) insert: Both is the
  sheet's text under a title linked to the sheet, never the citation block on
  top of it; Citation leaves out a summary that only repeats the title; the
  Voices transliteration follows each Hebrew passage in parentheses, and
  only Hebrew is transliterated.
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
- `aligned-rows.test.js` — the "Line by line" setting: side by side, each
  verse paired with its translation in its own table row (numbering, spanning
  refs, missing segments, per-row transliteration); Stacked, the two titles
  then each verse, its transliteration and its translation down the page
  (with several translations, each one's line in the order picked); off keeps
  one row, or one block per language. And the side-by-side transliteration's
  `transliteration_position` (schema 30): below the Hebrew (the default, and
  anything unknown), or a column of its own left or right of it, per row with
  Line by line; Stacked keeps it under the Hebrew, with several translations
  too. The column's title is the Hebrew title in Latin letters, linked like
  it, numbers as in the Latin reference (`server/transliterated-title.gs`):
  Sefaria's Latin title for it, the one of `indexTitle` / `titleVariants`
  that spells the Hebrew consonants, read as the scheme reads them ("Bereshit",
  Ashkenazi "Bereishis"; a Tanakh book's variants before its English main
  title; "Shmuel Aleph" not "Samuel I"; no abbreviations or markup); else the
  Hebrew title transliterated from a pointed spelling (Sefaria's
  `heTitleVariants`, else the Tanakh's book names); else Sefaria's Latin
  reference, never bare consonants.
- `translation-availability.test.js` — a translation with no text for the
  passage is left out of the version list (greyed out with "Show unavailable
  translations"), languages hidden in Preferences → Search are left out, and a
  failed availability lookup hides nothing.
- `translation-language-names.test.js` — the version list's filter box finds a
  language by its name in English, in itself or in another catalog language
  ("French", "français", "צרפתית"; `names` in `TRANSLATION_LANGUAGE_CATALOG`),
  as typed (any name that starts with the text), case, accents, vowel points
  and apostrophes aside; a code typed exactly is that language alone ("es" is
  not Esperanto too); no name belongs to two languages; titles still match.
- `rich-text-markup.test.js` — Sefaria markup with any attributes (Shulchan
  Arukh's commentary anchors) inserts without throwing; a source with one
  language inserts that language alone, with its title's entities decoded.
- `first-run-setup.test.js` — first-run setup and the Simple / Full interface
  mode: clicking through with the preselected answers writes nothing, only
  values the dialog can produce are stored, switching to Simple and back
  returns the user's own menu, setup is shown once (never to an upgrader), and
  the dialog's preview transforms its sample exactly as an insert would.
  Screen 1 has "I've used Sefaria for Google Docs" (that add-on's look);
  "Keep my settings" is offered only to someone with settings of their own,
  never at install.
- `title-link-and-fonts.test.js` — the source (Hebrew) title and the
  translation title each have their own link switch and font, linked or not;
  the linked style applies only with that title's "Hyperlink formatting
  override" on (schema v24 turns both on); a caller that passes only the old
  `insertSefariaLink` links both alike, as before; schema v23 copies the old
  values (`migrations.test.js`). Each title's "Name the edition" switch
  decides whether its linked form adds `(Translation • Edition)`; off, it is
  the reference alone, still linked (multi-translation blocks still name
  their version); schema v26 turns both on.
- `sidebar-session-saves.test.js` — the sidebar's session saves go one at a
  time (a quick second click once overwrote the first: the lost Vowels
  choice), switches re-draw only when nothing is left to save, and a change
  the fetch applies re-fetches once, with Add Source disabled meanwhile. A
  change made before the bootstrap gives the sidebar its session is kept.
- `citation-style.test.js` — the citation under a source has its own style
  (Preferences → Insertion → Layout → Citation style); its defaults and schema v25 keep the old
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
- `preview-emphasis.test.js` — the sidebar preview shows Combine and Drop as
  the insert writes them: the real server pipeline and the preview's mirrors
  give the same words, bold and italics.
- `sidebar-controls.test.js` — Preferences → Sidebar on the server: Voices
  and Lexicon are on unless switched off (only `"false"` hides one); hidden
  Quick Actions and Insertion Options are known ids only (junk hides
  nothing); the sidebar is told all of it before it paints (data attributes,
  one storage read, Simple mode too); it never reopens on a switched-off tab
  by itself but a menu item that names one opens it; the sidebar's copy of
  the rules agrees; schema v29 shows everything (`migrations.test.js`).
- `settings-profiles.test.js` — settings profiles: a profile holds the Text
  and layout and Fonts parts only (never the menu, interface, sidebar
  controls, search or linking); with none, nothing is stored; the first new
  one turns the settings in use into "My settings"; a switch keeps the
  outgoing values and writes the incoming ones in one `setProperties`; a
  profile kept aside is migrated when it comes back (schema-23 "torah" →
  "tanakh") and an invalid value is the default; names are cleaned and
  unique, ten at most, the last stays; too large is refused; the index is not
  a setting; failures log the message only.
- `lexicon-stale-response.test.js` — a Lexicon or Voices answer to an earlier
  search is dropped (the stale "No lexicon entries found for 'Genesis 1:1'"),
  and switching to the Lexicon looks nothing up.
- `search-tabs.test.js` — the three tabs share one search workflow
  (`sidebar/js/search-tabs`): typing searches the shown tab; Enter also
  searches, in the background, each other tab the text suits (no Lexicon
  lookup for "Genesis 1:1", no link in Voices) and that has no results for it;
  the pause after Enter searches nothing again; an answer lands in its own tab
  and its badge counts it; switching never searches and brings back a tab's
  results and selection (a sheet, a word with its picked entries, a Texts
  preview without a fetch, or with one if its answer came while away), the box
  keeping its text; a tab with nothing for the text offers "Search Lexicon for
  “…”"; a hint stays with its tab; Enter never searches a tab switched off in
  Preferences → Sidebar. Runs the real partials through
  `helpers/sidebar-search-harness.js`.
- `voices-topics.test.js` — Voices' topic categories are its corpora: a sheet
  is filed under the first of its topics that fits (the longest keyword wins:
  "Torah Study" is Values, "Laws of Shabbat" Halakhah; whole words only; no
  topics: its title; else Other); groups in the built-in or saved order, a ❌
  hides one, one left out in Preferences stays out unless its chip shows it, a
  hidden sheet is deselected; `voices_topic_order` / `_excluded` (schema 28):
  defaults "[]", in SETTINGS and the settings file's Search part, migrated
  without overwriting, edited in Preferences → Search → Voices Topics.
- `session-pins.test.js` — pins in every tab: a pinned sheet keeps its tab,
  the search that found it and what shows it again (its title whole); a word
  its headword; a text as before. Reopening (the Library window, its sidebar
  list, Recent) shows the entry's tab, runs that search and selects the entry
  when it answers, never after a delay; a sheet the search no longer lists is
  shown from the pin; older word entries open by headword or rid. Starred
  words become pins once, after the pins there; the sidebar and the Library
  window keep lists of the same length; Recent lists Texts' own entries.
- `lexicon-words.test.js` — a Lexicon search answers with words, not a flat
  list of entries: grouped by headword spelling (cantillation and mark order
  don't split one), the words spelled as typed first ("direct", by headword or
  alternate; with vowels typed, that exact spelling first), then related
  words; each entry's dictionary, part of speech, gloss, senses and credit. An
  English search is filtered to the path `Reference/Dictionary` (a title such
  as "Jastrow" is no path's start: it found nothing), falls back to Reference
  keeping only dictionary hits, keeps only the headwords it found, and says
  "unavailable" when Sefaria never answers. A headword's number is not part of
  the word ("שֵׁם ᴵ" Klein, "שֵׁם²" BDB, "שֵׁם I" Jastrow); glosses are read per
  dictionary (Jastrow's italics, BDB after its part of speech, Ben-Yehuda's
  first Hebrew sense without footnotes); BDB's number and stem wrappers take
  their only text. Fixtures: `fixtures/lexicon-shem.json`, `lexicon-shalom.json`,
  Sefaria's own answers, shortened (see their `_note`).
- `lexicon-insert.test.js` — Add Entry inserts one word's picked entries in
  the order picked: the word once, each entry's dictionary line, a paragraph
  per sense with the dictionary's numbers (sub-senses indented), notes in Full
  entry only; bold, italics and superscript kept; the translation's Commentary
  "Drop" never applies to a definition; an older sidebar's one-entry payload
  still inserts.
- `lexicon-entry-picker.test.js` — a word's entries are picked like
  translations (first selected, a click toggles, pick order kept, the last one
  stays, Select all appends); Matches / Related words / Closest words; Copy
  gives exactly the lines Add Entry writes, in every mode. Dictionaries are
  filtered like corpora, through the real results pipeline
  (`toggleCorpusVisibility`): a chip each with its count, a hidden one's
  entries leave every word, the selected word keeps the picks still shown.
- `lexicon-dictionary-preferences.test.js` — the saved dictionary order and
  hidden dictionaries (Preferences → Search → Lexicon Dictionaries;
  `lexicon_dictionary_order` / `_excluded`, schema 27): defaults "[]", in
  SETTINGS and the settings file's Search part, migrated without overwriting;
  a word's entries and the chips follow the saved order; a hidden dictionary
  is left out, its chip shows it for one search, a new search hides it again.
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
  version, the migrations that must exist for it, and every surface and doc
  it lists: each carries the full version, build included, and the current
  schema where it names one (see *Versions: keep them in sync*).
- `agent-guides.test.js` — `CLAUDE.md` and `AGENTS.md` are identical.
- `embedded-json.test.js` — server data force-printed into an inline
  `<script>` goes through `toEmbeddedJson_`.
- `csp-coverage.test.js` — every entry page carries the same
  Content-Security-Policy.
- `line-by-line-layout.test.js` — Line by line shows for every arrangement
  of both languages (Stacked too); the transliteration's Position (Below /
  Left / Right, in the card's Transliteration group) applies side by side only
  (Preferences shows it always); the Arrangement icons are told both and have
  the parts to sketch them; the card and the server read a stored position
  alike; every host reads, writes and sends it.
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
  hides only the search tools in the sidebar (no "More options"; the Texts /
  Voices / Lexicon tabs stay, only 🧪 goes), the footer
  is Add Source, Insertion Options, then Session Library / Quick Actions /
  Preferences in both modes, and the server tells each page its mode.
  Preferences has one Interface switch (no "Show advanced settings"):
  switching reloads no value, keeps unsaved Menu Bar edits and reaches an
  open sidebar without a refresh. Opening Preferences from the sidebar shows
  "Opening Preferences…" and ignores repeat clicks.
- `font-pickers.test.js` — every composition-card host has the font buttons
  and loads `shared/fonts` first; Preferences' font lists come from that one
  list; fonts Docs does not have (SBL Hebrew, Ezra SIL) are never offered;
  no font UI mentions borrowed marks (Help does).
- `preferences-font-editors.test.js` — Preferences has no Fonts tab: every
  font button (titles, Hebrew, transliteration, translation, Layout's Citation
  style) opens its one full editor in place, moved not copied; the sidebar
  and Link Texts keep the font panel; the transliteration scheme and Bold &
  italics have only the card's control.
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
- `card-hebrew-samples.test.js` — the composition card's Hebrew sample has
  one state per Vowels × Cantillation combination (cantillation shows with
  vowels off), each what the insert's filter makes of the full text.
- `voices-transliteration.test.js` — the Voices transliteration menu selects
  (the composition card reaches only its own menu, so a Voices choice never
  changes the Texts transliteration), shows the choice with a sample in
  parentheses, and saves it without resetting *What to insert*.
- `edition-label-rows.test.js` — "Name the edition / translation in the
  title" are rows under each "Link title to Sefaria" in Preferences, shown
  while that title is linked, and nowhere else.
- `surprise-me-shared.test.js` — the sidebar's Surprise Me card and the
  Surprise Me dialog are one form (`shared/surprise-me`), which shows what
  the server inserted.
- `sidebar-controls-ui.test.js` — the tabs show in Simple mode as in
  Everything; a switched-off tab is hidden except while it is open, and the
  bar goes with Texts alone (unless 🧪 is beside it; never in Simple); a
  hidden Quick Actions button goes, and with none left 🏃 goes and the row
  closes up; a hidden Insertion Options control goes in the sidebar only
  (never in Preferences or Link Texts) — each checked by matching the real CSS
  against the real markup in linkedom; one list of ids in the server, the
  markup, the CSS and Preferences; the Sidebar tab is in both interfaces (its
  Insertion Options part in Everything), saved with Save, and takes the
  Insertion Defaults sub-tabs with it.
- `settings-profiles-ui.test.js` — the profiles column is Everything only,
  beside the tabs, in a wider dialog; a name is drawn as text (linkedom); a
  switch or new profile asks about unsaved changes first, a rename doesn't;
  every change reloads and tells an open sidebar; the sidebar's picker shows
  with two or more and names the profile in use, and a switch there or in
  Preferences drops the session's Insertion Options changes.
- `preferences-layers.test.js` — the Preferences tab bar, pinned while the
  panel scrolls, paints over every open section (it went under them), and an
  open menu, the overlays and the dialogs still cover it.
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
- `docs/versioning.md` — the version numbering (every release is the next
  build of 2.0: 2.0.1, 2.0.2, …) and the one coupling that matters: a new
  preference key needs a default, a migration, a schema bump and a manifest
  bump, all in one commit, and ships in the next build.
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
- `apps-script/server/settings-file.gs` — the settings file (Preferences →
  Advanced): what an export holds and what an import may write.
- `apps-script/server/settings-profiles.gs` — settings profiles (Everything's
  Profiles column, the sidebar's Profile list): what a profile holds, and how
  a switch stores and restores it.
- `docs/ai-lesson/DESIGN.md` — design notes for the detached AI
  feature (not shipped in v1).
- `reference/ai-lesson/` — preserved AI source files, excluded from
  `clasp push` via `.claspignore`.
- `test/tests/` — Node unit tests.
- `test/ui/` — contract / snapshot / wiring tests.
- `pre_clasp_qc.sh` — the last line of defense before `clasp push`.
