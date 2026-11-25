# Sefaria API migration and commentary follow-up

**Observation date:** 2026-11-24. **Scope:** the add-on's text retrieval and
its response handlers, followed by the authorized A–D fixes and launch review. This is the
project handoff; the regression log and live test checklist remain the
records for bugs and release verification.

**Current artifact:** branch `review/launch-defaults-help-20261124`, based on
`fix/edition-commentary-notes-20261124` at `61805f8`. The API migration remains
[draft PR #58](https://github.com/OtterBrainDev/TorahLibraryAddOnForDocs/pull/58);
the follow-up is [draft PR #59](https://github.com/OtterBrainDev/TorahLibraryAddOnForDocs/pull/59),
with implementation commit `3b7d3eb`. Release **2.0.0** is unchanged;
the notes preference introduced schema **32**, and the launch defaults repair
advances it to **33**. Nothing in this handoff
establishes an Apps Script deployment, completed Google Docs testing, or a
Marketplace release.

## Decision and endpoint scope

Sefaria marks [Texts v1](https://developers.sefaria.org/reference/get-v1-texts)
deprecated and identifies [Texts v3](https://developers.sefaria.org/reference/get-v3-texts)
as the current reader. The reviewed sources establish no removal date. All
shipped passage-content requests now use v3, with no v1 retry or fallback.

API versions apply to individual operations. The current
[Ref](https://developers.sefaria.org/reference/get-ref) and
[Versions](https://developers.sefaria.org/reference/get-versions) APIs are
separate metadata operations; `/api/texts/versions/` is not the deprecated
`/api/texts/{tref}` reader. Other operations keep their supported routes.

| Operation | Route used after this change |
| --- | --- |
| Passage text, selected editions, translation availability | `/api/v3/texts/{tref}` |
| Reference validation and bounded section selection | `/api/ref/{tref}` |
| Edition catalog and language-family metadata | `/api/texts/versions/{indexTitle}` |
| Full-text search, including dictionary search | `/api/search-wrapper/es8` |
| Name completion | `/api/name/{query}` |
| Source-sheet search and content | `/api/search/sheet/_search`, `/api/sheets/{id}` |
| Dictionary entries | `/api/words/{word}` |
| Document citation detection and task polling | `/api/find-refs`, `/api/async/{taskId}` |
| Titles for the citation prefilter | `/api/index/titles/` |

The inventory is the shipped `apps-script` call sites. Historical/reference
code excluded from clasp is outside this migration.

## Request and response boundary

`server/sefaria-fetch.gs` owns URL construction and normalization. The sidebar,
selection insertion, Link Texts insertion, multi-translation insertion and
Surprise Me continue receiving the add-on's internal `he` / `text` payload.

- Default requests explicitly ask for `primary` and `translation`. An edition
  choice uses its catalog `languageFamilyName` and exact `versionTitle` as a
  repeated `version=family|title` parameter. Storage language alone cannot
  identify the request family: real Yiddish editions can be filed under `he`.
  Exact titles, including significant trailing spaces, are preserved.
- `fill_in_missing_segments=0` is deliberate. The old default reader could
  merge editions; the new request returns one edition's own text and gaps.
  This keeps the named edition and its credit truthful. A missing selected
  edition does not silently become another edition. See Sefaria's
  [legacy reader](https://github.com/Sefaria/Sefaria-Project/blob/master/sefaria/model/legacy_text.py)
  and [v3 adapter](https://github.com/Sefaria/Sefaria-Project/blob/master/sefaria/model/text_request_adapter.py).
- `return_format=default` keeps the original source HTML, including semantic
  footnote markup. The API migration itself changes neither Commentary modes
  nor note rendering; the A–D follow-up below uses this retained markup.
- V3's fetched `versions` become the selected `he` / `text` roles, with their
  titles, sources, licenses and language metadata. `available_versions`
  becomes the internal `versions` picker catalog. This catalog can be filtered
  to the requested passage; it is not necessarily every edition of the book.
  Reference/category metadata
  and nested segment arrays survive; null segment gaps become empty strings.
  Selected edition metadata is also retained as `sourceVersion` and
  `translationVersion` for the edition-specific commentary rules below.

### Reference bounds

Live checks found that a bare v3 `Genesis` request can return the entire book,
despite the current documentation's first-section description. The Ref
preflight restores the previous bounded behavior: `Genesis` opens `Genesis 1`,
while an explicit segment, chapter or cross-chapter range retains its bounds.

Complex books enter their default text before choosing a section; an
introduction must not displace the main text. Metadata traversal is limited
to four requests and rejects a change of work. A heading without default
content remains structural. Text replies must match the planned canonical
reference and index title before they can reach insertion or linker results.
These decisions follow inspected metadata and
[Sefaria's API implementation](https://github.com/Sefaria/Sefaria-Project/blob/master/api/views.py),
with real responses pinned in `test/tests/fixtures/sefaria-v3-*.json`.

### Availability, cache and failures

The deployed v3 API also rejects bare `version=all` as a language selector.
Availability now requests each catalog family's editions explicitly, such as
`version=english|all&version=hebrew|all`, with filling disabled and
`return_format=text_only`. This is an availability-only request; display
fetches retain HTML. Empty editions are unavailable; omitted or failed
answers remain unknown and never hide translations.

Public reference plans and compact edition metadata are cached per user for
up to six hours. Text is fetched fresh. Cache failure changes performance
only. Edition metadata is always cached under the requested reference. A
passage's narrower `available_versions` is never promoted to an index-wide
cache. On a cold exact-edition lookup, the Versions request uses the index
title established by Ref metadata. The availability cache has a new namespace so old answers cannot
survive the selector change.

Observed examples of this distinction: the Genesis index catalog had 56
editions, the `Genesis 1:1` catalog 52, and `Genesis 1:2` 50. These are dated
observations of the live API, not fixed library totals.

Missing-edition warnings remain attached to the normalized result; exact
selection prevents substitution. A sidebar edition fetch with a missing,
empty or mismatched requested edition leaves the pickers visible, disables
insertion and asks the reader to choose another edition. Unknown references remain ordinary misses.
Multi-translation insertion independently checks the explicitly selected
source edition after its refetch. Missing, empty or substituted source text
stops the operation before document writes; translation-only output can use
the valid translations without that unused source.
Network failures, rate limits, server errors, malformed successful responses
and mismatched response identities remain unavailable outcomes, with no
raw document text logged. Link Texts' batch recovery performs the same
metadata planning and normalization, preserves batch positions and reports
an unavailable citation without losing correctly resolved peers.

## Validation and release boundary

- Baseline before changes: **840 passing, 0 failing, 0 skipped**.
- Migration branch: **891 passing, 0 failing, 0 skipped**. This adds 51
  regressions to the baseline. Pre-clasp QC passes; its optional `clasp status`
  check was skipped because clasp is not installed in this environment.
- Live contract run, 2026-11-24 (21:06 Mountain time): **14 passed, 0 failed**,
  21 HTTP requests. Coverage includes default bilingual text, exact French
  and Yiddish, an alternate Hebrew edition, significant title whitespace,
  cross-chapter numbering, Obadiah, Sefer HaChinukh's default main text, Rashi's
  nested section, Berakhot, a structural heading, a missing edition,
  availability/cache reuse, and display filters with pointed transliteration.
  An independent review also checked Mesillat Yesharim's default main text.
- The opt-in read-only check is `node tools/check-sefaria-v3.js` (Node 22+
  and Python 3). It runs the production fetch/normalization code against
  Sefaria; it is intentionally separate from deterministic `npm test`.
- Real Google Docs checks remain pending in
  [checklist N1–N9](live-test-checklist-2.0.0.md#n-sefaria-v3-migration-pending).
  A live API pass does not verify Apps Script authorization, quotas,
  `DocumentApp`, browser rendering or actual insertion.

The API migration itself does not deploy an Apps Script project, create a
numbered version, publish a Marketplace release, change preferences/schema,
or change public RPC arities. The release number stays in `VERSION.json`.

## A–D follow-up — implementation and verification

The owner authorized the follow-up on a separate branch. Its starting point
is the tested v3 migration (**891 offline tests passed**), so selected edition
metadata and original HTML are available without changing API endpoints.

### A. Preserve editions during Insertion Options refreshes

A refresh of the current reference retains its chosen translation, Hebrew
edition, ordered multiple translations and selection anchor. A new reference
starts its own edition selection. Fetches use the retained editions instead
of requesting defaults. Request ownership is checked again after a preview
rebuild, because that rebuild can start a newer edition fetch; the older
callback must not install stale text or re-enable insertion. Missing-edition
responses retain the existing v3 guard and ask for another edition.

### B. One processor for semantic source notes

`apps-script/server/source-text.gs` is the canonical pure JavaScript
processor. `tools/sync-source-text.js` generates the client copy at
`apps-script/shared/source-text.html`; preview and insertion run the same
rules rather than maintaining separate parsers. The processor emits escaped
text and only its own `b`, `i`, `sup`, `sub` and `br` tags. The existing
allowlist sanitizer for other rich-content surfaces remains unchanged.

[Sefaria's formatting documentation](https://developers.sefaria.org/docs/text-formatting-beyond-the-segment-level)
defines a note marker as `sup.footnote-marker` and the body as `i.footnote`.
The processor recognizes semantic class tokens, nested formatting and
attribute variations. It handles marker and body together, preserves ordinary
superscript/subscript text, and keeps malformed annotation markup rather
than deleting the remainder of a passage. Notes are identified before
Commentary is applied, so bold inside a note cannot decide which translation
words survive. The same note choice applies to Hebrew and translation;
Commentary remains a translation-only option. Transliteration always reads
the main Hebrew without marked notes. Aligned preview processes each verse
separately, matching insertion note labels and placement; a generation guard
rejects older same-reference transliteration replies.

### C. Validated edition conventions

Profiles require the exact edition title, English language metadata and the
appropriate source category/work. Neither a bold tag nor square brackets
alone prove that words are commentary.

| Edition and scope | Default | Combine | Drop |
| --- | --- | --- | --- |
| `William Davidson Edition - English`, Babylonian Talmud | Keep bold base text and plain explanation | Keep all words; remove source bold, retain italics | Keep the bold base text, with its retained italics |
| `The Rashi chumash by Rabbi Shraga Silverstein`, the five Torah books | Keep bracketed Rashi additions | Keep the additions, removing their square brackets | Remove the bracketed additions |
| `The Rashi Ketuvim by Rabbi Shraga Silverstein`, Tanakh / Writings | Keep bracketed Rashi additions | Keep the additions, removing their square brackets | Remove the bracketed additions |
| Other editions or unmatched metadata | Keep text and source emphasis | Keep text and source emphasis | Keep text and source emphasis |

Sefaria's [publication introducing the Silverstein library](https://sefariaproject.wordpress.com/2015/10/12/the-shraga-silverstein-library/)
explicitly documents brackets for both the Chumash and Ketuvim. Current v3
responses confirm those conventions and the exact edition titles. The
compact live examples in `test/tests/fixtures/commentary-editions.json`
record their URLs, licenses, metadata and any excerpting.

Bracket handling respects nesting and each original source segment. A
segment with an unmatched opening or closing bracket stays whole, even in
Combine or Drop. This protects real malformed data such as Genesis 49:17 and
Genesis 24:7 in Silverstein. Unknown editions also remain whole: the JPS2023
`[I give]` in Genesis 1:30 is translated text, while its bold quotation in
Genesis 1:1 belongs inside a footnote. Kehot and separate Steinsaltz Tanakh
commentary works are not automatically registered from their author or
appearance; each additional convention needs evidence and tests.

### D. Notes preference and consistent controls

**Notes** appears in Layout below Line numbers, with `source_notes_mode`:

- `omit` (**Omit**, the default): leave out semantic notes and their markers.
- `inline` (**Inline**): include the note where it occurs in the text.
- `separate` (**Separate**): keep a marker and collect notes under a labelled
  Notes section below the passage, or below that line with Line by line.

Separate produces ordinary document text, not native Google Docs footnotes.
The choice is independent of Commentary: notes requested with Inline or
Separate remain available even when the translation's commentary is dropped.
Preview and insertion use the same choice, including Default Commentary.

Schema **32** seeds `source_notes_mode` to `omit` when absent. This preserves
what the old insertion path actually wrote; that path already omitted notes,
although Default preview could display them. The setting participates in
saved defaults, sidebar session overrides, profiles, settings-file Text and
layout, and Link Texts' per-insertion overrides. Existing saved values are
not overwritten by the migration. Help and tooltips explain the supported
editions, preservation fallback, and distinction between Commentary and Notes.

### Follow-up validation and next action

- Research completed on 2026-11-24 against live Sefaria v3 and the primary
  sources linked above. It is read-only API verification, not a Google Docs
  workflow test.
- **A–D offline validation:** 977 passed, 0 failed, 0 skipped, from a baseline
  of 891. This adds 86 regressions. Shared-parser parity, selection/save races,
  per-edition transformations, Notes, all insertion arrangements, profile
  migration and settings routes are covered. Required template snapshots were
  regenerated. Pre-clasp QC passes; optional `clasp status` was unavailable
  because clasp is not installed.
- **Live annotation checks:** 6 passed, 0 failed, 16 requests, observed
  2026-11-24 at 22:10 Mountain time. The production v3 reader and processor
  verified Silverstein Torah/Punctuation Off, a malformed Silverstein verse,
  Silverstein Ketuvim, JPS footnotes and supplied words, and Davidson base text.
  Reproduce with `node tools/check-sefaria-v3.js commentary`.
- A static browser rendering check could not run because this environment's
  Chromium launcher has no installed browser binary. DOM/markup contracts and
  parser tests pass; real browser/Docs visual verification is still pending.
- Regression coverage is in `sidebar-edition-selection.test.js`,
  `source-text.test.js`, `source-notes-settings.test.js`,
  `source-notes-insertion.test.js`, `preview-source-notes.test.js`, the
  preview/insertion parity tests, and preference/profile/settings-file suites.
- Real Google Docs checks **N1–N9 and O1–O14 remain pending** in the
  [live test checklist](live-test-checklist-2.0.0.md). In particular, verify
  note placement, formatting, selection persistence, and asynchronous refresh
  behavior against the exact reviewed HEAD deployment.

Review the A–D branch after the v3 migration; it is based on that migration
so the API work remains a separate change. Next action: review both draft
changes, then test their exact HEAD in Google Docs using N1–N9 and O1–O14
before any numbered release.

## Launch review — compatibility, defaults and documentation

The owner requested a further compatibility check, a defaults review,
sidebar simplification ideas and updated Help/tutorials before merging.
This work is on a third branch, leaving the two reviewed branches intact.

### Deliberate differences and remaining limits

| Behavior | Consequence for a reader | Decision / evidence |
| --- | --- | --- |
| Exact editions keep their own gaps | A partial translation can contain fewer words than the old merged default. An available edition may cover only part of a range. | Keep `fill_in_missing_segments=0` and accurate edition credit. Help and tutorials now explain this; an unavailable edition is different from an incomplete one. There is not yet a per-verse completeness indicator. |
| Catalogs can be limited to the passage | “Show unavailable translations” cannot reveal an edition that Sefaria omitted from the response. | Help now promises known unavailable entries, not the whole-book catalog. Availability means some text exists, not complete coverage. |
| Ref metadata precedes a cold passage lookup; exact edition selection may need the Versions catalog | A first lookup has additional HTTP work and another service dependency. | Metadata is cached; text remains fresh. Actual Apps Script latency and quota use require the live launch checks. Local API timing is not a Docs benchmark. |
| Sefaria chooses default editions by its current priorities | An unpinned default is not a permanent edition guarantee. | The API audit compared six live works and found the same default editions between v1 and v3 in those samples. Select an explicit edition when wording must be reproducible. |
| Missing selected editions do not silently fall back | The reader can be asked to choose another edition instead of receiving substitute words under the selected title. | Preserve exact edition identity. Single-language output should depend on its required role, and switching back to Both must revalidate. |
| Commentary acts only on verified edition conventions | Combine or Drop leaves an unsupported edition's words and source emphasis unchanged. | This is the A–D policy, not a v3 API limitation. Help names the three supported profiles and preserves malformed bracket segments. |
| Marked Notes are Omit by default | Some Default previews show fewer annotations than before; the old insertion path already omitted them. | Preview and insertion now agree. Inline and Separate are explicit alternatives; Separate makes ordinary Notes text, not native Docs footnotes. |
| Preview is a content preview | Pagination, exact document typography and all inserted translations still need document inspection. Source images and arbitrary HTML styling are not reproduced. | Correct the prior claim that preview is an exact image of insertion. Preserve an image's supplied description as plain text, as the old preview did, without loading the image. |

The primary sources still identify [Texts v1 as deprecated](https://developers.sefaria.org/reference/get-v1-texts)
and [Texts v3 as the current reader](https://developers.sefaria.org/reference/get-v3-texts),
without an announced removal date. There is no reason in this review to
restore a v1 content fallback. Search, sheets, dictionaries and metadata keep
their own supported API routes.

### Compatibility fixes found in this review

1. A bilingual publication can give its Hebrew and English editions the same
   title. The normalizer previously excluded all candidates carrying the
   other selected role's title. It now excludes only that selected edition
   object, preserving the opposite language. The real regression fixture is
   `Rashi on Genesis 1:2:1`, **Pentateuch with Rashi's commentary by M.
   Rosenbaum and A.M. Silbermann, 1929-1934** (both editions Public Domain).
2. A missing selected edition in an unused language no longer blocks
   single-language output. The actual Display handler refetches when
   recovering from a failed preview, and revalidates newly required roles
   when changing back to Both. Already valid bilingual data is reused.
3. The new shared text processor now preserves image descriptions that the
   old preview sanitizer retained. Descriptions are escaped text in preview
   and insertion; descriptions inside notes follow the Notes choice.

The six direct v1/v3 default-edition comparisons returned matching source
and translation titles for `Kuzari 1:1`, `Guide for the Perplexed, Part 1 1`,
`Mishneh Torah, Human Dispositions 1:1`, `Mishnah Berakhot 1:1`,
`Rashi on Genesis 1:1`, and `Berakhot 2a:1`. These were read-only audit
requests on 2026-11-24, not a v1 path in shipped code. This sample does not
establish identical defaults or coverage throughout the library. No default
selector was changed speculatively.

### Preference defaults

Keep the current text defaults: Both languages, Hebrew on the right, line
numbers on, line-by-line off, title links and edition credits on, fonts that
match the document, Commentary Default, Notes Omit and transliteration off.
Vowels and cantillation remain on where supplied. The existing divine-name
choice stays intact. Interface defaults are separate: skipping setup keeps
Everything; the returning-user purpose preselects Simple without changing
these content rules.

The review found three settings present in `SETTINGS` but absent from
`getDefaultPreferences()`. Their controls had fallbacks, while Reset and
profile snapshots did not. Schema **33** supplies the same existing behavior:

| Setting | Canonical default | User-facing result |
| --- | --- | --- |
| `voices_insert_mode_default` | `reference` | Voices: Citation |
| `voices_translit_default` | `none` | Voices transliteration: None |
| `lexicon_insert_mode_default` | `entry` | Lexicon: Full entry |

The migration fills absent values and repairs only the literal invalid
`undefined` value generated by old profiles. Valid stored choices remain
untouched. Inactive profiles receive the same repair through the existing
profile migration path. Settings import rejects that invalid value so an old
file cannot restore it. A regression now requires a defined canonical default
for every `SETTINGS` key.

One existing distinction remains: the untouched cantillation default uses
`available` (keep marks where supplied), while explicitly selecting the
Tanakh button writes the narrower `tanakh` filter. The control maps the former
to Tanakh because that is where marks normally occur. This pass documents the
default accurately and does not silently change it for another corpus.

### Sidebar proposal — not implemented in this pass

The source and translation sections already collapse. The visible Layout
controls, icon-only choices, typography controls mixed with content choices,
and the distinction between session changes and saved defaults still make a
long first encounter. The proposed next UI pass is:

| Placement | Controls / information |
| --- | --- |
| Always visible at the top | Display, Arrangement when Both is selected, and a short readable summary of the active settings. Add text labels to the icon choices. |
| Collapsed “Text and notes” group | Vowels, cantillation, punctuation, transliteration, Commentary and Notes, with the existing applicability rules. Notes remains independent of Commentary. |
| Collapsed “References and numbering” group | Title links, edition labels where offered, source credits, line numbers and line-by-line layout. |
| Collapsed “Fonts and appearance” group | Existing font controls, retaining the shared editors and “Match the document” behavior. |
| Persistent session context | Say that changes apply to this sidebar session; keep Revert and Save as defaults visible when changed. |

Closed groups should summarize their active values, especially Notes Inline /
Separate, Commentary Drop, disabled credits and custom formatting. Closing a
group must not alter values or cause an extra fetch. Keep one set of controls
and shared handlers across hosts; this is a presentation change, not another
stored interface tier or preset. Keep explicit user-hidden controls hidden.

Until that UI pass, the current **Preferences → Sidebar → Insertion Options**
visibility controls can reduce the sidebar for a particular class. They keep
using the saved defaults. The owner should review the proposed grouping
before implementation; current Help/tutorials describe the existing UI.

### Documentation and release boundary

Current Help, About, release notes, README, upgrade guidance, Marketplace
handoff and tutorial scripts are reconciled to the implemented rules.
Historical review records retain their original observations and receive a
superseded notice where they had directed readers toward future v3 work.
Tutorials are source-checked scripts; no recording or real Docs verification
is implied. The current version remains **2.0.0 pending release**.

### Launch review validation and next action

- **993 offline tests passed, 0 failed, 0 skipped**, up from 977: eight
  defaults/reset/profile regressions, six v3/Display regressions and two
  image-description regressions. Required template snapshot regeneration
  completed without a snapshot diff. Pre-clasp QC passed; optional clasp
  status was unavailable because clasp is not installed here.
- **Two new live production-reader checks passed**, 4 HTTP requests,
  observed 2026-11-24 at 23:14 Mountain time. Both explicit en-only and
  he-only choices for the genuine Rashi shared-title edition retain both
  languages. Reproduce with
  `node tools/check-sefaria-v3.js 'bilingual shared title'`.
- Independent review found no blocker in the edition identity, Display
  recovery/save ordering or escaped image-description changes.
- **Google Docs checks N1–N9, O1–O14 and P1–P7 remain pending.** Section P
  adds the launch defaults, partial-coverage, actual latency and updated
  tutorial checks. Source review and local API calls do not establish a
  tested Apps Script deployment, a recording or a public release.

Review the third branch after the v3 and A–D changes. Merge order is the API
migration, then A–D, then this follow-up; test the resulting exact HEAD in
Google Docs before creating a numbered release. The sidebar grouping above
is the proposed next UI pass, with no structural redesign applied here.
