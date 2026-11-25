# Sefaria API migration

**Observation date:** 2026-11-24. **Scope:** the add-on's text retrieval and
its response handlers. This is the migration handoff; the regression log and
live test checklist remain the records for bugs and release verification.

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
  footnote markup. The migration changes neither Commentary modes nor the
  existing note-rendering policy.
- V3's fetched `versions` become the selected `he` / `text` roles, with their
  titles, sources, licenses and language metadata. `available_versions`
  becomes the internal `versions` picker catalog. This catalog can be filtered
  to the requested passage; it is not necessarily every edition of the book.
  Reference/category metadata
  and nested segment arrays survive; null segment gaps become empty strings.
  Selected edition metadata is also retained as `sourceVersion` and
  `translationVersion` for the later commentary work.

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

This change does not deploy an Apps Script project, create a numbered
version, publish a Marketplace release, change preferences/schema, or change
public RPC arities. The release number stays in `VERSION.json`.

## Next separate pass

A–D remain outstanding: preserve selected editions through Insertion Options
refreshes; share semantic footnote handling between preview and insertion;
add validated edition-specific commentary profiles, preserving unknown
conventions; and add the agreed note-output choices with matching Help and
tooltips. Review that work separately after this migration's Google Docs
checks, using the retained version metadata and original HTML.
