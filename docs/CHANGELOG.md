# Changelog

All notable changes in this fork are documented here.

## Unreleased — traditional citation forms (2026-09)

### Added

- **Traditional Hebrew citation abbreviations now resolve.** "Hil. Shabbat 1:1"
  is how people cite Rambam; Sefaria indexes that section as "Mishneh Torah,
  Hilchot Shabbat" — so the literal string resolved to nothing and the failure
  read as "Sefaria doesn't have it". `server/citation-abbreviations.gs` now
  offers the indexed forms as additional lookup candidates, covering the 81
  Mishneh Torah sections Sefaria registers under a `Hilchot X` title. Accepts
  `Hil.`, `Hil`, `Hilchos`, `Hilkhot` and friends, and canonicalizes in place
  when the reader already named the work ("Rambam, Hil. Teshuvah 3:4").
- **A partial-overlap pass for suggestions**, used only when the exact and
  all-tokens passes both come back empty. This is what rescues "Hil. Avodah
  Zarah 12:11": Sefaria files that section as "Mishneh Torah, Hilchot Avodah
  **Kochavim**", so "Zarah" can never match and no amount of string
  normalization will find it — but "Hilchot" and "Avodah" do, which is enough to
  offer the section and let the reader decide.

### Changed

- Suggestion ranking weights matches by **characters** rather than token count.
  "Hilchot Avodah Zarah" matches two tokens against both *Avodah Zarah* (the
  Talmud tractate) and *Mishneh Torah, Hilchot Avodah Kochavim*. Counting tokens
  equally ranked the tractate first — the wrong work. Weighting by length lets
  "Hilchot", the word that says which work this is, outweigh the shorter
  "Zarah".
- A section registered under several work names is offered once, under the name
  Sefaria displays when you open it ("Mishneh Torah, …" rather than
  "Rambam, …"), so the suggestion matches where the reader lands.

### A note on what is deliberately NOT done

Expansions may only **add** words, never drop them. "Hil. Avodah Zarah" must not
become "Avodah Zarah", because that is a real Sefaria title — the Talmud
tractate — and rewriting the query would resolve confidently to the wrong work.
Queries that cannot be expanded safely fall through to suggestions instead. A
confident wrong answer is worse than no answer.

## Unreleased — jQuery upgrade (2026-09)

### Security

- **jQuery upgraded from 1.9.1 (2013) to 3.7.1, pinned with Subresource
  Integrity** and loaded over an explicit `https://` rather than a
  protocol-relative URL. 1.9.1 carries known XSS-relevant advisories, and it is
  the code interpreting every `$(...).html()` call in the add-on — jQuery's
  `.html()` executes script elements in the markup it is handed, which plain
  `innerHTML` does not, so the version implementing it matters more than the
  call count alone suggests.
- The integrity hash was computed from the bytes `ajax.googleapis.com` actually
  serves rather than copied from a published list, and CORS was confirmed
  (`Access-Control-Allow-Origin: *`) so SRI can be enforced. **If the hash is
  wrong, jQuery does not load and the sidebar is inert** — re-verify it, never
  guess it, when bumping the version.

### Migration notes

The codebase was audited for APIs removed between 1.9 and 3.x — `.andSelf`,
`.size`, `.live`/`.die`, the `.load`/`.unload`/`.error` shorthands,
`$.browser`, two-argument `.toggle` — and none were in use. The single
`:visible` selector (`shared/composition-card/shared.html`) is safe: jQuery 3
widened that test rather than narrowing it, and the element it guards is a
`<div>` with initial text, so it always has a layout box.

**This one wants a real sidebar before the Marketplace push.** The audit is
static; a 14-year version jump deserves the sidebar, preferences dialog, and
Voices/Lexicon tabs each opened once. It is deliberately its own commit so it
can be reverted independently of the sanitizer and CSP work.

## Unreleased — preview hardening (2026-09)

### Security

- **Sefaria HTML is stripped of subresource-loading markup before it is
  rendered.** Sefaria bleaches text records on save, so event handlers and
  `javascript:` URLs cannot reach the add-on — but their allowlist does permit
  `<img src>` and `<a href>`. A text naming a third-party host would make the
  reader's browser fetch it, leaking an IP and the fact that a particular
  passage was opened. New `sanitizeSourceHtml()` removes elements that fetch a
  subresource or execute, unwraps anchors (keeping their words), keeps an
  `<img alt>` as text, and strips `on*` and URL-bearing attributes. It is a
  strip, not an allowlist: `b`, `i`, `em`, `strong`, `sup`, `sub`, `span`,
  `br`, and the `class`/`dir` attributes that footnotes and RTL runs depend on
  all pass through untouched.
- Applied at the three places raw Sefaria HTML reached the DOM: the text
  preview, the Elasticsearch highlight snippets in the results list, and
  `extractTextFromHtml_`.
- **`extractTextFromHtml_` was making a network request.** It assigned
  untrusted markup to a detached `<div>`'s `innerHTML` to read its plain text —
  and a detached div still causes the browser to fetch any `<img src>` in the
  markup. It now parses into an inert `DOMParser` document.
- **Content Security Policy** added to the shared head partial, restricting
  `img-src` to sefaria.org, the-merkaz.org and Google's own hosts, plus
  `object-src 'none'` and `base-uri 'self'`. It deliberately does **not** set
  `default-src` or `script-src`: HtmlService injects its own bootstrap and the
  `google.script.run` bridge, and a script-src that missed one of them would
  silently break the server bridge rather than fail loudly. This is the backstop
  for any render path added later that forgets to sanitize.

## Unreleased — formatting control and search recovery (2026-08)

### Added

- **Text colour and highlight for every insertion role.** Hebrew, translation,
  transliteration, source title and hyperlink each gain a colour and a
  highlight control in Preferences → Fonts. Both default to *unset*, meaning
  "leave the document's own formatting alone" — a native colour input cannot
  express that, so the state is carried alongside the picker and shown as a
  muted field with an **Auto** / **None** button. Defaulting these to
  `#000000` would have silently restyled every existing user's documents,
  including anyone working in a themed or dark document.
- **Advanced: map the source's emphasis to your own formatting**
  (Preferences → Source Emphasis). Sefaria's bold and italic no longer have to
  render as bold and italic. Each channel maps independently to any
  combination of bold / italic / underline, a text colour, a highlight, and a
  font override — so the Steinsaltz Talmud's bolding can come through as, say,
  blue text if that matches your document's conventions. Turning every option
  off in a card drops that emphasis entirely. Defaults are the identity
  mapping, so nothing changes until you touch it.
- **Zero-result searches now suggest related catalogue entries.** Searching
  something the library does not match exactly offers up to five real titles
  to click, instead of an empty panel. When nothing is close enough to
  suggest, the panel says so and names the query shapes that work rather than
  rendering blank.

### Fixed

- **"Did you mean" never fired for a fragment from the middle of a title.**
  The suggester only considered titles beginning with the same letter as the
  query — right for typos, useless for fragments. Searching *A Woman's
  Commentary* offered nothing, because the catalogue entry is *The Torah: A
  Women's Commentary*: different first letter, and one letter different in the
  token that matters. A second token-overlap pass now matches titles
  containing every significant word of the query, tolerating a one-character
  difference per token and ignoring stopwords. Suggestions remain suggestions —
  they are never auto-selected.

### Changed

- All typography now flows through a role-based helper
  (`applyRoleTypography_`), so colour and background reach every insertion
  path — texts, source sheets and lexicon entries alike — rather than only the
  ones that happened to be updated. `getTypographySettings()` gained a `roles`
  map; the previous flat keys are kept as aliases.
- Suggestion cap raised from 3 to 5.

## Unreleased — privacy, emphasis, and search fixes (2026-08)

### Added

- **Privacy policy** (`docs/PRIVACY.md`), linked from Preferences and from
  Help & Support → About. Documents every scope, everything sent to Sefaria,
  and the fact that the add-on has no server, no analytics, and no account.
- **Preferences → Privacy & Document Scanning.** New `linker_scan_mode`
  setting controlling how much of your document "Link Texts with Sefaria"
  uploads.
- **Client-side linker pre-filter** (`apps-script/server/linker-prefilter.gs`).
  The document is now scanned locally first; only passages that could contain
  a citation — a known Sefaria book title, a chapter:verse number, a Talmudic
  daf, or a Hebrew abbreviation — are uploaded, with padding for context.
  Prose containing no citation never leaves the document.
- **First-run disclosure** before "Link Texts with Sefaria" uploads anything,
  naming which scan mode is active. Shown once, then remembered.
- **Preferences → Source Emphasis** toggle (`preserve_source_emphasis`).

### Fixed

- **Search returned nothing for titles containing an apostrophe.**
  `expandShevaApostrophe` rewrote every consonant-apostrophe pair, so
  "A Woman's Commentary" was searched for as "A Womanes Commentary" — and the
  same mangled string was used for the /api/name lookup, the direct-reference
  resolve and the content search, so all three failed at once. The rule now
  only fires on a word-initial 1-2 consonant cluster, which is the only shape
  a transliterated sheva takes. "P'sukei D'Zimra" → "Pesukei DeZimra" still
  works; "Jacob's Ladder" and "don't" are left alone.
- **Inserted text lost the source's bold and italics.**
  `applyTypographyToParagraph` blanket-cleared bold/italic across the whole
  paragraph right after `insertRichTextFromHTML` had set it per-run from
  Sefaria's markup. This destroyed, among others, the Steinsaltz Talmud's
  bolding of the Talmud's own words against Steinsaltz's interpolated
  explanation. Emphasis is now captured before the baseline style is applied
  and re-asserted after it, so your font-style preference sets the baseline
  and the source's emphasis layers on top. Titles and metadata lines
  deliberately do not preserve — their emphasis is the add-on's, not the
  source's.
- Text following an unclosed `<b>`/`<i>` in Sefaria markup no longer loses its
  emphasis (`insertRichTextFromHTML` forced the trailing run to un-emphasized
  instead of using the live state).
- Hebrew single-language insertion applied `nullStyle` (which carries
  `BOLD=false`) *after* the text was inserted, unlike every other body path.
  Moved to the empty paragraph, matching the others.
- **No size guard on the linker upload.** A document over 100,000 characters
  silently timed out and reported "0 references". It now fails with an
  explicit message naming the limit.

### Changed — read this one

- **"Link Texts with Sefaria" no longer uploads your whole document by
  default.** Existing users are migrated to `linker_scan_mode: "candidates"`
  (schema v7). This is a deliberate privacy decision, not a new feature gate:
  the whole-document upload was never disclosed to users. The trade-off is
  slightly lower recall on unusual citation forms the local scan does not
  recognize. **Preferences → Privacy & Document Scanning → Whole document**
  restores the previous behavior exactly.
- `preserve_source_emphasis` defaults to `true` and is migrated ON for
  existing users (schema v6), because the previous flattening was a bug rather
  than a preference.
- CI deploy workflow (`.github/workflows/deploy.yml`) rebuilt: the job is now
  gated on `github.repository`, so a fork — including an upstream maintainer
  merging from this one — never attempts to deploy into this fork's Apps
  Script project. It also runs `npm test` and `pre_clasp_qc.sh` in a separate
  `verify` job before the deploy job runs, pins `@google/clasp` (the token
  conversion targets clasp 2.x, and "latest" silently moved to 3.x), passes
  the token via `env:`, adds a concurrency group, and fails with a clear
  message when `CLASP_TOKEN` is unset. The stale personal branch trigger is
  gone; `workflow_dispatch` replaces it.
- `test/tests/migrations.test.js` reads `PREFS_SCHEMA_CURRENT_` from the
  source instead of hardcoding it in five assertions.

## Unreleased — pre-upstream review pass (2026-08)

A safety/sanity review ahead of proposing this fork upstream. No feature
changes; the Sefaria API surface, OAuth scopes, and a full code review are
summarized in `docs/pre-upstream-review.md`.

### Fixed

- `releaseNotesPopup()` called `SpreadsheetApp.getUi()` in a Docs-only add-on.
  Dead code today (nothing calls it), but it would have thrown on first use and
  is the only reference in the project that could cause a Sheets OAuth scope to
  be inferred. Now `DocumentApp.getUi()`.
- Enabling **Pin "Insert from Selection" at top of menu** showed the menu item
  twice; the unconditional copy is now suppressed when the item is pinned.
- `htmlToPlainText_()` (source-sheet rendering) decoded HTML entities *before*
  stripping tags, so an escaped `a &lt; b` decoded to `a < b` and was then eaten
  by the tag-stripper. Tags are stripped first now, and `&amp;` is decoded last
  so `&amp;lt;` no longer double-decodes.
- `formatDataForPesukim()` read `data["sections"][1]` unguarded and threw on
  resolved payloads that carry no `sections` (dictionary entries, some complex
  book-level refs). `insertion.gs` already guarded the same read.
- `onInstall` seeded preferences from a second, drifted copy of the defaults —
  it omitted ~14 keys and disagreed with `getDefaultPreferences()` on the
  translation and transliteration font sizes. It now derives from
  `getDefaultPreferences()` plus an explicit `getFreshInstallPreferenceOverrides_()`
  (divine-name substitution stays ON for new installs), and stamps
  `prefs_schema_version` so a new install does not re-run every migration.
  **Note:** new installs now get 12pt translation/transliteration text instead
  of 11pt. Existing users are unaffected.
- `experimental_features_enabled` is listed in `SETTINGS` and read by the
  sidebar but had no entry in `getDefaultPreferences()`, so it resolved to
  `undefined`. Added with an explicit `false`.
- `test/ui/snapshots/preferences.html.snap` was stale (hand-edited rather than
  regenerated), leaving `npm test` red on the branch. The Hebrew preview string
  in `preferences.html` was also accidentally de-normalized away from NFC;
  restored, and the snapshot regenerated.

### Changed

- `runUserPreferenceMigrationsIfNeeded_()` now compares the stored schema
  version numerically (`from < N`) instead of chaining `current !== 'N'`
  guards. The old form worked but required editing two conditions per new
  version and would re-run the newest migration for any version above it.

### Security

- Source-sheet content is third-party user-generated data (anyone can publish a
  Sefaria sheet). Media-node URLs and the sheet URL were written into the user's
  document as live hyperlinks with no scheme check. Both now go through
  `safeLinkUrl_()`, which allows only `http:`, `https:` and `mailto:` and
  rejects values containing control characters. Non-linkable values still render
  as visible text.
- `parseSefariaUrlInput()` accepted any hostname *containing* `sefaria.org`,
  including `sefaria.org.evil.example`. It now requires the host to be
  `sefaria.org` or a true subdomain, over http/https only.
- `pre_clasp_qc.sh` gained check **9b**: jQuery `$(sel).html(x)` is the same
  sink as `.innerHTML =` but check 9 never saw it. 9b applies the same
  justification-comment standard to dynamic `.html()` writes. It reports at WARN
  (16 pre-existing sites) so CI stays green while the count is burned down.

## v1.0 — cleanup pass (2026-04)

Everything below is grouped under the one-shot cleanup that brought the rewrite branch to a shippable state. The eight stages were individually commits; see `git log --grep='^Stage '` for the commit history.

### Added (guardrails and contracts)

- `AGENTS.md` / `CLAUDE.md` at the repo root — hard rules, known regression traps, and scope fence for future contributors (human or AI).
- `docs/regression-log.md` — dated table of bugs that regressed silently, each with the pinning test that now holds it down.
- `docs/architecture.md` — server/client boundary, storage layers, include graph, guardrail inventory.
- `docs/rpc-surface.json` + `test/ui/rpc-surface.test.js` — frozen list of every `google.script.run.X` target, enforced in both directions.
- `test/ui/contracts/sidebar-bootstrap.schema.json` + `test/ui/sidebar-bootstrap-shape.test.js` — shape contract for `getSidebarBootstrapData`. The sidebar also validates the shape at load time and logs a structured `console.warn` on mismatch.
- `apps-script/migrations.gs` — schema-versioned user-preference migrations (v2 restores divine-name substitution for upgraders; v3 scrubs detached-AI state).
- `.github/workflows/test.yml` — `npm test` + `pre_clasp_qc.sh apps-script` on every push.
- `pre_clasp_qc.sh` — now walks the nested `apps-script/` tree, is include-graph-aware for duplicate-function detection, and FAILs on `.innerHTML` writes without a justification comment.
- `docs/ai-lesson/DESIGN.md` + `reference/ai-lesson/` — preserved design for the deferred AI lesson feature, with the Merkaz / CacheService / Sefaria-hosted routes documented.

### Fixed (silent regressions, each with a pinning test)

- Divine-name substitution silently stopped applying on insert for upgrading users (`apply_sheimot_on_insertion` was added defaulting to `false`). v2 migration restores it.
- `extendedGemaraPreference` module-scope global set but only read on sidebar-open paths; Quick Actions menu callers saw stale `false`. Reads the preference at call time now.
- `formatDataForPesukim` appended `\n` between verses even when line markers were off, turning prose into paragraph-break-per-verse. Restored original space-joined prose.
- "Refresh Sidebar" button in preferences called a server function that did not exist; click silently no-opped. Binding restored.

### Changed (ergonomics and structure)

- `insertReference` replaced its 9-positional-parameter signature with a named-options bag: `insertReference(data, opts)`. The 350-line body is unchanged.
- Hebrew and English divine-name helpers unified behind one config-driven `applyDivineNameReplacements(data, userProperties, options)`; the two legacy entry points remain as thin wrappers.
- Code.gs domain split (menu / preferences / sefaria-fetch / text-processing / insertion / search / sheets) deferred to a follow-up pass; see `docs/architecture.md` § Follow-up.
- CSS token drift cleaned up: hardcoded `#18345d`, `#22426f`, `#ddeeff`, `#445267` in CSS partials now reference `var(--sefaria-blue)`, `var(--selected)`, `var(--selected-hover)`, `var(--selected-soft)`, `var(--footer-button-text)` from `apps-script/css/tokens.html`. Entry templates were already inline-style-free.

### Removed

- Cross-project Review Schema / ProvenanceRecord / Living Library / Commentary Builder / GOLEM pollution from README, CHANGELOG, and tests.
- `testRef()` debug function and a commented-out `/* ---- test harness --- */` block inside `insertReference`.
- AI lesson generator from the shipped add-on; preserved under `reference/ai-lesson/`. The `userinfo.email` OAuth scope is dropped with it.

### Security

- Every `.innerHTML =` write now either uses `textContent` + `document.createElement` (preferred) or has an adjacent justification comment; pre-clasp QC FAILs unannotated writes.
- Every `<a target="_blank">` in shipped HTML has `rel="noopener noreferrer"`.
- `Logger.log` call sites audited; no `UserProperties`, credentials, or raw document text reaches the log.

### Deferred

- Hebrew misspelling tolerance (valid Hebrew-script refs are supported; typo correction is not implemented).
- AI lesson generator (see `docs/ai-lesson/DESIGN.md` for the full rationale and the Sefaria-hosted route recommendation).
- Code.gs domain split (see `docs/architecture.md` for the starting-order checklist).

## Pre-cleanup — Fork enhancements

### Added
- Unified **Find & Insert Source** sidebar replacing the older split insertion/search workflow.
- Grouped results with **Library matches** first and **Search results** second.
- Explicit **select -> preview -> insert** flow instead of click-to-insert search behavior.
- Sefaria-style display controls:
  - Source
  - Translation
  - Source with Translation
- Bilingual layout options:
  - Hebrew on top
  - Hebrew left
  - Hebrew right
- Visible Hebrew formatting controls:
  - Vowels
  - Cantillation
- Translation details / attribution controls for inserted translation content.
- Typography preferences:
  - Hebrew font
  - Hebrew font size
  - Translation font
  - Translation font size
- English divine-name replacement preference (`God` -> `G-d`).
- Sidebar actions:
  - Insert Sefaria link
  - Open on Sefaria
  - Open divine name preferences
- Document-wide **Link Texts with Sefaria** menu action.
- Preference-gated Popcorn availability.
- Local lightweight attribution tests.

### Changed
- Refactored the main insertion/search UX into a single unified sidebar.
- Improved translation version selection and long-title handling.
- Improved nested/breadcrumb-style display in results and preview.
- Improved handling of structural/non-leaf nodes with clearer non-insertable messaging.
- Improved language label normalization for translations, including lightweight suffix-based fallback.
- Updated menu structure to emphasize the unified workflow.
- Updated release/documentation text to reflect the expanded scope of the add-on.
- Updated divine-name workflows across insertion-time transforms and menu-driven document transformations.

### Fixed
- Search result click-target issues.
- Silent insert failure when text was selected in the Google Doc.
- Translation selector interaction reliability.
- Result overflow/wrapping issues.
- Preferences scrolling/layout issues.
- Divine-name transformation handling for marked Hebrew forms.
- Multiple regressions discovered during manual QA across unified search, insertion, preview, and preferences.

### Deferred
- Hebrew misspelling tolerance remains deferred; valid Hebrew-script refs are supported, but typo correction is not yet implemented.
