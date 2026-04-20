# Torah Library Add-On for Google Docs

A Google Docs add-on that brings Sefaria-powered source finding, previewing, insertion, linking, and formatting into Google Docs.

> This is not an official Sefaria project.

## Project overview

This repository contains the Google Apps Script code and add-on UI templates used to:

- find a Sefaria source by reference, title, nested path, or phrase,
- preview the selected source before insertion,
- insert Source, Translation, or Source with Translation into the active Google Doc,
- configure Hebrew/translation display and formatting preferences,
- link inserted or existing references to Sefaria,
- apply divine-name transformation preferences, and
- manage user preferences through persistent `PropertiesService` settings.

The codebase is intentionally lightweight and Apps Script-native, without trying to emulate Google Docs APIs locally.

## Main features
See [docs/CHANGELOG.md](./docs/CHANGELOG.md) for a fuller summary of changes and [LICENSE.md](./LICENSE.md) for the repository license.

### Unified Find & Insert workflow

The add-on now centers on a unified **Find & Insert Source** sidebar that combines direct lookup and search into a single workflow:

1. find a source by reference, title, nested path, phrase, or Sefaria URL,
2. select a result,
3. configure display/layout/options,
4. preview it,
5. insert it into the current Google Doc.

The sidebar groups results into:

- **Library matches** first
- **Search results** second

### Display and layout controls

The unified sidebar supports:

- **Source**
- **Translation**
- **Source with Translation**

For bilingual insertion, layout options include:

- **Hebrew on top**
- **Hebrew left**
- **Hebrew right**

### Hebrew formatting controls

The unified sidebar includes visible Hebrew formatting controls for:

- **Vowels**
- **Cantillation**

Advanced source-edition/version controls remain available for cases where a specific source edition is needed.

### Translation/version handling

The add-on supports:

- version-aware translation selection,
- improved translation label handling,
- translation filtering,
- language-aware translation display labels,
- optional translation details/attribution in inserted output.

### Linking features

The add-on supports:

- **Insert Sefaria link** for inserted content,
- **Open on Sefaria** for the currently selected result,
- **Link Texts with Sefaria** as a document-level action for turning recognizable references in the current Doc into Sefaria hyperlinks.

### Preferences

Persistent user preferences include:

- orthography controls,
- divine-name transformation controls,
- Hebrew font and font size defaults,
- Translation font and font size defaults,
- optional English divine-name replacement,
- preference-gated legacy features such as Popcorn.

### Structural-node handling

When a selected result is a non-leaf or structural node rather than directly insertable text, the sidebar now provides clearer guidance and keeps insertion disabled until a text-bearing node is selected.

## Key enhancements in this fork

This fork substantially expands the original add-on workflow, including:

- replacing the older split insertion/search flow with a unified sidebar,
- improving search-result selection and preview behavior,
- adding bilingual layout controls,
- surfacing Vowels and Cantillation controls,
- improving translation/version selection UX,
- adding linking workflows,
- adding typography preferences,
- improving divine-name workflows,
- improving structural-node guidance and preview clarity.

See [docs/CHANGELOG.md](./docs/CHANGELOG.md) for a fuller summary of changes and [LICENSE.md](./LICENSE.md) for the repository license.

## Translation details / attribution

When Translation text is inserted, the add-on can optionally append a compact translation details block.

Behavior summary:

1. Translation details are only relevant when Translation is inserted (Translation-only or bilingual output).
2. The formatter first uses `data.versionSource` when present.
3. If missing, it falls back to matching `data.versions`.
4. If no source is found, it still emits a version-title-only block when possible.
5. If no usable translation version title is available, no translation-details block is inserted.

## Canonical knowledge-contract consumers

This repository now includes schema-focused contract adapters for multiple consumer types:

- display-oriented consumer baseline: Living Library tooltip (`TooltipPayload`) (documented externally),
- editorial-oriented consumer baseline: Commentary Builder glossary hints (`GlossaryTerm`) (documented externally),
- workflow/editorial-governance consumer: Review Schema alignment helpers for `ReviewStatus` and `ProvenanceRecord` (this repo pass).

See [`docs/review-schema-alignment.md`](./docs/review-schema-alignment.md) and [`apps-script/review-schema-contract.js`](./apps-script/review-schema-contract.js) for the low-risk schema/adaptor implementation.

## Menu actions

The add-on menu includes:

- **Find & Insert Source**
- **Transform Divine Names**
- **Link Texts with Sefaria**
- **Preferences**
- **Support**
- **Popcorn** (legacy/original-developer feature, preference-gated)

## Demo and walkthrough

- [Worked example Google Doc](PASTE_GOOGLE_DOC_LINK_HERE)
- [Google Docs walkthrough](./docs/google-docs-walkthrough.md)


## Repository structure

- `LICENSE.md` - Repository license.
- `README.md` - Project overview, workflow notes, and contribution/testing guidance.

### Apps Script implementation

All Google Apps Script source files now live under `apps-script/`:

- `apps-script/Code.gs` - Main Apps Script server logic (menu setup, Sefaria API calls, insertion, linking, preferences, divine-name transforms, typography application).
- `apps-script/appsscript.json` - Apps Script project manifest.
- `apps-script/attribution.js` - Pure helper module for translation/source attribution logic.
- `apps-script/consts.gs` - Constants and supporting data.
- `apps-script/main.html` - Unified Find & Insert sidebar UI.
- `apps-script/preferences.html` - Preferences dialog UI.
- `apps-script/release-notes.html` - Release notes modal.
- `apps-script/support-and-features.html` - Support/feature request modal.
- `apps-script/popcorn.html` - Legacy/original-developer Popcorn feature UI.
- `apps-script/search.html` - Legacy search UI retained only as historical/reference material if still present.
- `apps-script/package.json` - Local package metadata for lightweight test tooling.

### Documentation

- `docs/CHANGELOG.md` - Summary of major enhancements in this fork.
- `docs/google-docs-walkthrough.md` - End-user walkthrough for the current unified workflow.

### Tests
- `tests/attribution.test.js` - Lightweight local unit tests for attribution formatting/fallback behavior.
- `tests/review-schema-contract.test.js` - Lightweight local unit tests for Review Schema contract normalization and adapters.

## Development workflow

### 1) Make a focused change

- Keep changes small and PR-friendly.
- Prefer pure helpers for logic that can be tested outside Google Docs APIs.
- Avoid adding local infrastructure that tries to emulate `DocumentApp`.

### 2) Run local unit tests

Prerequisite: Node.js 18+ (for built-in `node:test`).

```bash
npm test
```

Current local tests are intentionally lightweight and cover pure logic only.

### 3) Manual validation in Apps Script

Before opening a PR against the production add-on repo, validate in a separate Apps Script test project and a non-production Google Doc.

Recommended manual validation includes:

- unified search/find flow works,
- result selection and collapse behavior works,
- Source / Translation / Source with Translation insertion works,
- bilingual layout options work,
- Vowels / Cantillation toggles work,
- translation details behavior works,
- linking features work,
- preferences persist and affect insertion correctly,
- divine-name transforms behave as expected.


### 4) Local testing details

Current local tests intentionally cover only pure logic such as:

- attribution formatting,
- source fallback resolution,
- empty/edge input behavior.

They do **not** attempt to emulate Google Docs `DocumentApp`, cursor behavior, selection behavior, or table insertion APIs.

This keeps local testing fast and maintainable while still guarding against regressions in isolated logic.

### 5) Contribution guidelines

Open small, reviewable PRs where possible.

Include:

- what changed,
- why,
- local test results,
- manual validation notes.

For formatting or insertion changes, include before/after examples or screenshots when possible.

## Licensing

The source code in this repository is licensed under the [MIT License](./LICENSE.md).

This project uses the Sefaria API but is not an official Sefaria project.
Texts and metadata retrieved from Sefaria may carry separate attribution,
copyright, or reuse terms depending on the source text.



# Add-on UI Refactor Pack

This pack contains guardrails, a migration checklist, test scaffolding, and a package.json script snippet to help Codex refactor your Apps Script add-on UI without drifting from your existing UX.

## Files included

- `docs/ui-refactor-guardrails.md`
- `docs/ui-refactor-checklist.md`
- `tests/validate-html-includes.mjs`
- `tests/validate-selectors.mjs`
- `tests/validate-page-contracts.mjs`
- `tests/snapshot-page-templates.mjs`
- `tests/fixtures/expected-selectors.json`
- `package-scripts-snippet.json`

## How to use

1. Copy the `docs/` and `tests/` folders into your repo.
2. Merge the scripts from `package-scripts-snippet.json` into your existing `package.json`.
3. Adjust `tests/fixtures/expected-selectors.json` to match your actual critical selectors.
4. Run `npm run test:ui-snapshots` once to generate baseline snapshots.
5. After each Codex pass, run `npm run test:ui`.

## Notes

- The selector fixture is intentionally conservative and should be customized to your real contract.
- The snapshot test is structure-oriented, not a visual browser screenshot test.
- The JS contract test will intentionally fail until the shared/page module files exist.
