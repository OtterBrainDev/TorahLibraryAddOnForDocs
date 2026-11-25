# Sefaria for Google Docs

A Google Docs add-on that brings Sefaria-powered source finding, previewing, insertion, linking, and formatting into Google Docs.

> This is version 2.0 of *Sefaria for Google Docs*, prepared for Sefaria to
> publish through its existing Marketplace listing. It is a release candidate:
> Sefaria has not yet approved or published it. See
> [`docs/for-sefaria-review.md`](./docs/for-sefaria-review.md).

## Privacy

This add-on has no server of its own, no account, and no analytics. Google runs
it and lets it read and edit **only** the document you have it open in; Sefaria
is the only party that receives anything you search for or anything from your
document. Its sidebar and dialogs also load a script library, a stylesheet, a
font and a few images from Google and Sefaria, like any web page — none of
those requests carries your data.

Read the full policy: **[`docs/PRIVACY.md`](./docs/PRIVACY.md)**.

The one command that sends text you did not type is **Link Texts with Sefaria**,
which uploads document text so Sefaria's reference linker can find citations in
it. By default only the passages that look like they contain a citation are
uploaded — see *Preferences → Linking → Privacy & Document Scanning*, and §2.1 of the
policy.

## Contributing (human or AI)

Before editing anything beyond a typo, read **[`AGENTS.md`](./AGENTS.md)** (also duplicated as `CLAUDE.md`). It covers: what this codebase actually is, the non-negotiable rules, the anti-pattern catalog, and where the canonical documents live. Companion docs:

- [`docs/architecture.md`](./docs/architecture.md) — server/client boundary, storage layers, RPC surface, include graph.
- [`docs/regression-log.md`](./docs/regression-log.md) — every bug that has regressed silently, with the pinning test now holding it down.
- [`docs/rpc-surface.json`](./docs/rpc-surface.json) — the frozen list of server functions reachable from the client.

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

The add-on centers on a unified sidebar that combines direct lookup and search into a single workflow. Three tabs under the search box, **Texts** / **Voices** / **Lexicon**, search texts, source sheets or dictionary words; each keeps its own results and selection, typing searches the tab in view, and Enter searches the others too:

1. find a source by reference, title, nested path, phrase, or Sefaria URL,
2. select a result,
3. configure display/layout/options,
4. preview it,
5. insert it into the current Google Doc.

The sidebar groups results into:

- **Library matches** first
- **Search results** second

### Display and layout controls

The sidebar's **📰 Insertion Options** panel (the full-width button under
**Add Source**) sets this session's insertion; **Preferences → Insertion** sets
the defaults, and Link Texts' **📰 Customize this insertion** one linking pass.
Its **Display** control has three modes:

- **A** — translation only
- **A + א** — Hebrew with translation
- **א** — Hebrew only

For bilingual insertion, **Arrangement** offers:

- **Stacked** (Hebrew above the translation)
- **Right–Left** (Hebrew on the right)
- **Left–Right** (Hebrew on the left)

with switches for **Citation**, **Line by line** (each verse with its
translation: side by side, a table row per verse; Stacked, each verse and then
its translation, down the page) and **Line numbers**. Each Arrangement icon
sketches the page it gives with the other settings.

### Hebrew and translation formatting controls

The panel's **Insertion Format** card has a **Source** (Hebrew) section and a
**Translation** section, each folding to a one-line summary. They hold:

- **Link title to Sefaria**, **Title font** and **Text font** (each section its own),
- **Vowels** (Off / Tanakh / On) and **Cantillation** (Off / Tanakh / Torah),
- **Punctuation** (each section its own),
- **Transliteration**, with its **Style** and, side by side, its **Position**
  (below the Hebrew, or a column of its own left or right of it),
- **Commentary** (Default / Combine / Drop) for supported translations:
  preserve the edition's markings, combine its translation and explanation,
  or leave out recognized explanation. The William Davidson English
  Babylonian Talmud uses bold base text; Silverstein's Rashi Chumash and Rashi
  Ketuvim use bracketed additions. Other editions retain their words and
  source emphasis, and a verse with malformed brackets stays whole.

**Notes**, under Layout, separately controls marked footnotes in Hebrew and
translation: **Omit** (the default), **Inline**, or **Separate**. Separate
adds a labelled Notes text section below the passage, or below each line with
Line by line; it does not create native Google Docs footnotes. Dropping
commentary never removes a note requested with Inline or Separate.

Hebrew marks a chosen font lacks (often the cantillation) are set in Noto
Serif / Sans Hebrew, so they never show as empty boxes.

Advanced source-edition/version controls remain available for cases where a specific source edition is needed.

### Translation/version handling

Choose one translation or, with Translation only or Stacked, several in
selection order. Changing Insertion Options keeps the selected translation,
Hebrew edition and order. The preview waits for the matching text before
insertion is enabled.

Passage content uses Sefaria Texts v3. The chosen edition supplies its own
text: missing verses are not filled from a different edition under the same
credit. A missing or mismatched edition needed for the chosen Display
requires another choice.
The edition list reflects Sefaria's catalog for the requested passage and
may differ between passages. A book name opens a bounded first section;
the preview title says which passage will be inserted.

The preview uses the insertion rules for words, commentary and notes. It is
not a complete rendering of a Google Docs page: generated line numbers,
chapter headings, pagination and the final document font must be checked in
the document. With several translations selected, it lists their names
instead of rendering every translation. The
[migration handoff](./docs/sefaria-api-migration.md) records API scope,
deliberate behavior changes and pending live checks.

### Linking features

The add-on supports:

- **Insert Sefaria link** for inserted content,
- **Open on Sefaria** for the currently selected result,
- **Link Texts with Sefaria** as a document-level action for turning recognizable references in the current Doc into Sefaria hyperlinks.

### Simple or Everything

New users get a short first-run setup and can pick **Simple** (search, preview,
insert, with fewer tools in view and a shorter menu) or **Everything**.
Existing users keep Everything. Switch at the top of Preferences; Simple hides
with CSS only, so nothing is lost. In either one, **Preferences → Sidebar**
leaves out the Voices or Lexicon tab, Quick Actions buttons and (Everything)
Insertion Options controls. Everything also keeps **profiles**, named sets of
how sources look (one per class), and **settings files** (Preferences →
Advanced) to hand a class or an organization the same settings.

### Preferences

Persistent user preferences include:

- orthography controls,
- divine-name transformation controls,
- Hebrew font and font size defaults,
- Translation font and font size defaults,
- optional English divine-name replacement,
- preference-gated experimental features such as Surprise Me.

### Structural-node handling

When a selected result is a non-leaf or structural node rather than directly insertable text, the sidebar now provides clearer guidance and keeps insertion disabled until a text-bearing node is selected.

## Coming from version 1.0

Most people arrive from version 1.0 of
[*Sefaria for Google Docs*](https://workspace.google.com/marketplace/app/sefaria_for_google_docs/849562338091)
([help](https://help.sefaria.org/hc/en-us/sections/20235182393244)): one
sidebar (**Add Sources with Sefaria**) and two commands (**Transform Divine
Names**, **Link Texts with Sefaria**), with format, edition and translation
picked for each source and nothing saved. Version 2.0 replaces it in place;
no settings carry over because 1.0 stored none. The same commands are under
**Extensions → Sefaria for Google Docs** (Texts, and Quick Actions); what's new is saved defaults, layout and formatting choices,
reviewed linking, and the Voices, Lexicon and Session Library tools. Two
things work differently out of the box: divine names are replaced as sources
are inserted (יהוה → יי), and each source gets a credit line. In-app Help has
a *Coming from version 1.0* topic, and
[walkthrough 4](./docs/walkthroughs/4-returning-user.md) is the demo script.

## What's new compared with the original add-on

Version 2.0 builds on the original Sefaria add-on for Google Docs by Shlomi
Helfgot (see [LICENSE.md](./LICENSE.md)), the code it grew from, and
substantially expands it, including:

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

## Source attribution

Each inserted source can carry a small credit block under it, and this is **on
by default** (the **Citation** switch in 📰 Insertion Options, or Preferences →
Insertion → Layout). Many
Sefaria texts are CC-BY or CC-BY-NC, so the credit is what lets a user reuse
them properly.

1. The translation is credited whenever it is inserted (Translation-only or
   bilingual): its version title, source site, digitizer and license
   (`apps-script/attribution.gs`).
2. The Hebrew edition is credited whenever it is inserted (Hebrew-only or
   bilingual): its version title and its own license (`heLicense`).
3. When no version title is available for an edition, that edition gets no
   credit line rather than an empty one.

## AI lesson generator (deferred)

An AI-assisted lesson / shiur drafting feature was developed on the rewrite branch and **is not shipped in 2.0**. The design — including both the Merkaz-gateway route and a future Sefaria-hosted gateway recommendation — is preserved in [`docs/ai-lesson/DESIGN.md`](./docs/ai-lesson/DESIGN.md). The source files are preserved, not shipped, under [`reference/ai-lesson/`](./reference/ai-lesson/). If you are picking this up (including upstream Sefaria.org engineers), start with the design doc: it documents the trade-offs that kept the feature out of 2.0 and the checklist that any revival should work through.

## Menu actions

The add-on menu (**Extensions → Sefaria for Google Docs**) includes, by default:

- **Texts** — the unified search-and-insert sidebar.
- **Voices** — source-sheet search with insert controls.
- **Lexicon** — dictionary lookup.
- **Insert Source from Selection** — look up the selected reference and insert it.
- **Quick Actions** submenu — Quick Actions Sidebar, Transform Divine Names, Link Texts with Sefaria, Unlink Sources, Gematriya Count.
- **Surprise Me** — preference-gated experimental feature (random-reference discovery).
- **Preferences** and **Help & Support** — always last.

Users can reorder, group and hide items in **Preferences → Menu Bar**.

## Demo and walkthrough

- [Google Docs walkthrough](./docs/google-docs-walkthrough.md)
- [Live walkthroughs](./docs/walkthroughs/README.md) — five scripts for live demos: a stress test, a developer tour, a power-user tour, a guide for people coming from version 1.0, and a five-minute first run.


## Repository structure

- `LICENSE.md` - Repository license.
- `README.md` - Project overview, workflow notes, and contribution/testing guidance.

### Apps Script implementation

All Google Apps Script source files live under `apps-script/` (clasp rootDir):

- `apps-script/server/*.gs` — server logic, one file per domain: `menu.gs` / `menu-layout.gs` (menu and dialogs), `sefaria-fetch.gs` and `search.gs` (Sefaria API), `insertion.gs` (writing sources into the document) and `transliterated-title.gs` (the transliteration column's title), `document-actions.gs` (linking, divine-name transforms, insert from selection), `linker-prefilter.gs` and `citation-abbreviations.gs` (linker support), `preferences.gs`, `text-processing.gs`, `sheets.gs`, `lexicon.gs`, `utils.gs`.
- `apps-script/triggers.gs` — the `onInstall` / `onOpen` simple triggers (kept at the root on purpose; see the file header).
- `apps-script/appsscript.json` — Apps Script project manifest.
- `apps-script/attribution.gs` — dual-mode (Apps Script + Node test) helper for translation/source attribution.
- `apps-script/config.gs` — `DEV_FLAGS` object.
- `apps-script/gematriya.gs` — gematriya numerals.
- `apps-script/migrations.gs` — schema-versioned `UserProperties` migrations keyed by `prefs_schema_version`.
- `apps-script/surprise-me-feature.gs` — "surprise me" random-reference feature.
- `apps-script/transliteration.gs` — Hebrew→Latin transliteration engine with biblical-dagesh mode.
- `apps-script/ui_core.gs` — shared UI-side helpers.
- `apps-script/sidebar.html` — main sidebar entry template (composes `sidebar/js/*.html` partials).
- `apps-script/preferences.html` + `apps-script/preferences/` — preferences dialog entry template and its CSS/JS partials.
- `apps-script/surprise-me.html` + `apps-script/surprise-me/` — surprise-me dialog.
- `apps-script/help-modal.html`, `feedback-modal.html`, `session-library-modal.html`, `gematriya-count.html`, `release-notes.html` — standalone modal dialogs.
- `apps-script/css/` — tokens and component styles composed via `include()`.
- `apps-script/shared/` — ui-head, composition-card, and core shared partials pulled into every entry template.

### Documentation

- `docs/CHANGELOG.md` - User-facing changes by release.
- `docs/google-docs-walkthrough.md` - End-user walkthrough for the current unified workflow.
- `docs/PRIVACY.md`, `docs/TERMS.md` - Privacy policy and terms of service.
- `docs/marketplace-listing.md` - Google Workspace Marketplace console package and release procedure.
- `docs/for-sefaria-review.md` - For Sefaria: review notes, and what is left to publish it under Sefaria's name.
- `docs/architecture.md`, `docs/regression-log.md`, `docs/versioning.md` - For contributors.

### Tests
- `test/tests/*.test.js` - Unit tests for server logic (insertion, attribution, preferences and migrations, Hebrew display and divine names, linker, search normalization, the HTML sanitizer, triggers), loading the real `.gs` files via `vm`.
- `test/ui/*.test.js` - Template, contract and snapshot tests for the sidebar and dialog entry points.
- Run everything with `npm ci && npm test` from the repo root. `CLAUDE.md` lists every test file and the expected count.

## Development workflow

### 1) Make a focused change

- Keep changes small and PR-friendly.
- Prefer pure helpers for logic that can be tested outside Google Docs APIs.
- Avoid adding local infrastructure that tries to emulate `DocumentApp`.

### 2) Run local unit tests

Prerequisite: Node.js 22 (what CI uses).

```bash
npm ci    # once per checkout; installs the test-only devDependency
npm test
```

Local tests cover logic and templates; they do not emulate Google Docs.

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

Local tests cover logic that can run outside Google Docs — formatting,
preferences and migrations, text processing, the linker's pre-filter — plus
contract and snapshot tests of the HTML templates.

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

This repository is a release candidate offered to Sefaria; it is an official
Sefaria release only once Sefaria publishes it.
Texts and metadata retrieved from Sefaria may carry separate attribution,
copyright, or reuse terms depending on the source text.
