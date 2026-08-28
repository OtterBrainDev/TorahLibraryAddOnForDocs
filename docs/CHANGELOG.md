# Changelog

All notable changes in this fork are documented here.

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
