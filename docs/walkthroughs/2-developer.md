# Walkthrough 2 — Under the hood

**Audience:** developers, including Sefaria engineers reviewing the add-on.
**Time:** 45–60 minutes. **Format:** two windows side by side: a Google Doc
with the add-on on the left, this repository and the Apps Script
**Executions** page on the right. Each section is one user action, followed
by what runs on the client and the server.

For the short map, see [`docs/architecture.md`](../architecture.md). This walkthrough follows a
request through that map. File references are to `apps-script/` unless noted.

---

## 0. The shape of the thing (5 min)

Say this first, because it explains most of the design decisions:

- **It's a Google Docs editor add-on in Apps Script (V8).** No server of our
  own, no database, no account. Google runs the code, under the user's
  identity, with four OAuth scopes (`appsscript.json`):
  `documents.currentonly`, `script.container.ui`, `script.external_request`,
  `script.storage`. The add-on can touch **only the open document**.
- **Two runtimes.** `.gs` files run on Google's servers. `.html` files are
  rendered by `HtmlService` into a sandboxed iframe in the user's browser. The
  only bridge is `google.script.run.fn(args)`: asynchronous, JSON-serialisable
  arguments, and **silent if `fn` doesn't exist**. That last point is why
  `docs/rpc-surface.json` exists.
- **One global scope.** Every `.gs` file, including those under `server/`,
  shares a single global namespace at runtime. The directory split is only for
  organisation. `pre_clasp_qc.sh` rejects duplicate basenames because of this.
- **No module loader, no bundler.** HTML is composed server-side with
  `<?!= include('path/to/partial'); ?>` (`server/utils.gs:include`). Nothing
  under `apps-script/` depends on an npm package. `linkedom` is a test-only
  devDependency.
- **Sefaria is the only data source.** Every network call goes to
  `www.sefaria.org` through `UrlFetchApp` on the **server**. The browser side
  loads only jQuery (with SRI), a Google font and stylesheet, and Sefaria
  images. See `docs/PRIVACY.md` §2.2.

Show `apps-script/` in the file tree:

```
triggers.gs            onInstall / onOpen: must stay at the root (regression log)
migrations.gs          schema-versioned UserProperties migrations
server/                one file per domain; menu, search, fetch, insertion, linker…
sidebar.html           the main entry template → sidebar/js/*, shared/ui/*, css/*
preferences.html       second entry template
*.html (root)          standalone dialogs, each its own window scope
attribution.gs, gematriya.gs, transliteration.gs   pure, Node-testable helpers
```

---

## 1. Install and open (5 min)

**Do:** install the test deployment in a Doc. Open **Extensions**.

**What runs:**

1. `onInstall(e)` (`triggers.gs`) calls `seedDefaultPreferences_()`
   (`migrations.gs`). It writes every key from `getDefaultPreferences()`
   (`server/preferences.gs`) that the user has **no stored value for**, and
   never overwrites one. `menu_layout` is deliberately left unset, so the user
   keeps tracking the code's default menu.
2. `runUserPreferenceMigrationsIfNeeded_()` reads `prefs_schema_version` and
   runs every `migrateToV<N>_` with `from < N`, then stamps `13`. Each
   migration only fills keys that are absent.
3. `onInstall` then calls `onOpen(e)` itself, because `onOpen` doesn't fire
   for the document you install from. Before this fix, the menu only appeared
   after a reload.
4. `onOpen` has two failure guards. In `AuthMode.NONE`, before the user has
   authorised, reading `PropertiesService` isn't allowed, so it builds the
   default menu with `installDefaultMenu_()`. If a migration or a preference
   read throws, it logs the error and still builds a menu.
5. `buildAndInstallMenu()` (`server/menu.gs`) takes the stored `menu_layout`
   (or the default), plans it with the pure `planMenuFromLayout_()`
   (`server/menu-layout.gs`: each item at most once, Preferences and Help
   always last), and adds it with `installMenuPlan_()`.

**Why it looks like this:** the hard rules in `CLAUDE.md` 1–2 and the first
row of `docs/regression-log.md`. A preference added with a `false` default and
no migration once turned divine-name substitution off for every upgrading user.
Now every new key comes with a default, a migration, a schema bump, a
`VERSION.json` bump and a changelog entry, all in the same commit
(`docs/versioning.md`). `test/ui/version-manifest.test.js` enforces this.

**Show:** `test/tests/migrations.test.js` and `test/tests/triggers.test.js`.
Both load the real `.gs` into a `vm` context with fake `PropertiesService` and
`DocumentApp` objects.

---

## 2. Open the sidebar (5 min)

**Do:** Extensions → Torah Library → **Texts**.

**What runs:**

1. `textsHTML()` → `openSharedSidebar_('texts')` (`server/menu.gs`).
2. `HtmlService.createTemplateFromFile('sidebar')` evaluates `sidebar.html`,
   which `include()`s 35 partials: `shared/ui/head` (CSP, jQuery with
   SRI), `css/tokens`, `sidebar/js/*`. Server data is embedded as
   `appConfigJson = toEmbeddedJson_(getUiAppConfig_(…))` (`ui_core.gs`). Any
   force-printed template variable must go through `toEmbeddedJson_`, which
   escapes `</script>` and the like. `test/ui/embedded-json.test.js` enforces
   this after a source-sheet title managed to close the Session Library's
   inline `<script>`.
3. In the browser, `sidebar/js/bootstrap.html` calls
   `google.script.run.getSidebarBootstrapData(mode)`. The server runs the
   migrations again (they're idempotent, and this covers admin installs where
   `onInstall` never fires), then returns
   `{accountPreferences, sessionState, effectivePreferences, sessionId}`.
4. **Two storage layers** meet here:
   - **Account preferences:** `UserProperties`, persistent, and they follow the
     Google account into every Doc.
   - **Sidebar session overrides:** `CacheService.getUserCache()`, keyed by
     `sessionId`, with a 6-hour TTL (`setSidebarSessionState`). The Layout
     tray writes here. **💾 Save as defaults** copies session into account
     (`saveSidebarSessionAsAccountDefaults`).
   - A third, client-only one: the Session Library and search history live in
     the iframe's `localStorage`. They never reach the server.
5. The client checks the bootstrap object against
   `test/ui/contracts/sidebar-bootstrap.schema.json` at load time and logs a
   structured `console.warn` if it doesn't match.
6. `returnTitles()` fetches `/api/index/titles` for autocomplete and the
   linker pre-filter, cached by `getSefariaTitlesCached_()` in chunks under
   CacheService's 100 KB value limit.

**Show:** the browser console on sidebar open (no warnings) and the
Executions page (`getSidebarBootstrapData`, `returnTitles`).

---

## 3. Search (10 min)

**Do:** type `hil. shabbat 1:1` slowly. Then `in the beginning`. Then
`the torah a womens commentary deuteronomy 29 9-14`.

**What runs** (`sidebar/js/search-controller.html:runUnifiedQuery`, debounced):

1. **Client normalisation** (`sidebar/js/search-utils.html`). It works on a
   *copy* of the input and never writes back to the box while the user types:
   the "fighting the cursor" regression. It turns transliterated sheva
   apostrophes into vowels only word-initially (`P'sukei` → `Pesukei`, while
   `Woman's` is left alone), makes Hebrew punctuation consistent, and matches
   titles by their **words**, ignoring punctuation and case, then rewrites the
   title to Sefaria's spelling.
2. Up to three RPCs run in parallel:
   - `getNameCandidates(q)`: `GET /api/name/{q}?limit=6` (autocomplete).
   - `findReference(q)`: direct resolution. On the server,
     `resolveReferenceWithFallbacks` (`server/sefaria-fetch.gs`) tries, in
     order: the normalised form, the original, the form with Hebrew numeral
     marks stripped, then **citation-abbreviation expansions**
     (`server/citation-abbreviations.gs`: `Hil.` → `Mishneh Torah, Hilchot`).
     An expansion may only **add** words. Dropping one could quietly point the
     query at a different work that really exists. Each candidate is a
     `GET /api/texts/{ref}?commentary=0&context=0`.
   - `findSearchAdvanced(q, …)`: full text,
     `POST /api/search-wrapper/es8` (`server/search.gs`).
3. Results are grouped: library matches, then search results, then **Close
   matches** (a token-overlap and edit-distance pass over the title list).
   Close matches are never opened automatically.
4. Everything that renders Sefaria HTML goes through `sanitizeSourceHtml`
   (`shared/ui/dom.html`). It's an **allowlist** (inline typography only), and
   its output is re-parsed and must come back the same, or the caller gets
   escaped text. It replaced a blocklist that mutation XSS got past
   (`<math><mi><table><mglyph><xmp>…`). The Node tests use linkedom, which
   can't reproduce parser mutations, so sanitizer changes are also checked in
   headless Chromium.

**Show:** `test/tests/search-input-normalization.test.js`,
`citation-abbreviations.test.js`, `sanitize-source-html.test.js`, and the
regression log rows for the apostrophe, gershayim and `Pesalms` bugs. They're
three versions of one lesson: **a lossy normalisation should be tried as an
extra candidate, never swapped in for what the user typed.**

---

## 4. Preview (3 min)

**Do:** click a result.

**What runs:** `findReference(ref, versions)` again, with the chosen versions.
The **server** applies, in order, `applyHebrewDisplayPreferences` (niqqud and
teamim filters), `applyHebrewDivineNamePreferences` and
`applyEnglishDivineNamePreference` (`server/text-processing.gs`) before
returning. So the preview is exactly what will be inserted. The original
add-on made the same choice, and the comment in `findReference` still says why.

Divine-name rules are a config table (`allRules` in `text-processing.gs`).
Each rule has an `enabledBy` key, a Unicode-aware pattern that treats
niqqud and teamim as transparent, and a replacement used **literally**
(`$&` is not expanded). יה only matches as a whole word; יהוה and אלהים
still match with a prefix. See `test/tests/divine-name-rules.test.js`.

---

## 5. Insert (10 min)

**Do:** Hebrew + English, **Right–Left**, Lines on, **🔗 Title** on. Click
**Add Source**. Then select three translations with Stacked layout and insert
again.

**Single insert:** `google.script.run.insertReference(data, opts)`
(`server/insertion.gs`). The arity is 2, pinned by the RPC contract. It used
to be nine positional booleans, and swapping two of them silently changed what
got inserted.

1. `formatDataForPesukim(data, lineMarkers)` flattens the verse arrays into
   numbered lines (gematria for Hebrew, `gematriya.gs`) or space-joined prose.
2. **Where to insert:** the cursor or selection is walked up to its
   body-level ancestor. Tables, headers and footers are refused with a message
   rather than guessed at. Apps Script proxy objects aren't `===`-comparable,
   so the walk compares `getType()` to `BODY_SECTION`.
3. **Layout:** Stacked is paragraphs. Right–Left and Left–Right are a 2-column
   table with the Hebrew paragraphs set RTL, which is how the original add-on
   did it.
4. **Typography:** `getTypographySettings()` resolves each role (title,
   linked title, Hebrew, transliteration, translation). An empty font or size
   means **match the document**: `readSurroundingTextStyle_()` reads the
   paragraph at the insertion point, or the nearest body-text paragraph above
   it. All styling goes through `applyRoleTypography_(paragraph, typography,
   role, overrides)`.
5. **Rich text and emphasis:** `insertRichTextFromHTML` turns Sefaria's `<b>`,
   `<i>`, `<sup>` and entities into Docs runs. `decodeHTMLEntities`
   (`server/utils.gs`) is a single-pass table decoder, which fixed the literal
   `&thinsp;` bug. Then `captureEmphasisRuns_` → the baseline style →
   re-assert, mapped through the user's emphasis settings
   (`applyEmphasisMapping_`). Without this, the Steinsaltz Talmud loses the
   bold that marks the Talmud's own words.
6. **Credit block:** `attribution.gs`, a dual-mode helper that runs both in
   Apps Script and in Node. It credits the translation version and license and
   the Hebrew edition and its `heLicense`, and prints no empty lines.

**Multi-translation:** `insertReferenceVersions(ref, opts)` fetches one
`/api/texts` per version. Each result is checked with `selectInsertableVersions_`,
because Sefaria **substitutes the default version** when you ask for one that
doesn't cover the ref, and can return empty text. Mismatches are skipped and
reported, not inserted. (`docs/pre-upstream-review.md` §1.2 explains why moving
to `/api/v3/texts` would reduce this to one request, and why that isn't a
simple URL change.)

**Show:** `test/tests/multi-version-insert.test.js`,
`typography-defaults.test.js`, `format-data-for-pesukim.test.js`. **Be
upfront:** nothing here can test `DocumentApp` itself. The Node suite covers
the pure parts, and `docs/live-test-checklist-2.1.0.md` covers the rest by
hand.

---

## 6. Link Texts with Sefaria (10 min)

This is the only feature that sends text the user didn't type, so it gets the
most time.

**Do:** run it on the shared demo document (`README.md` in this folder).

**What runs** (`server/document-actions.gs`):

1. `linkTextsWithSefaria()` → `confirmLinkerUploadOnce_(scanMode)`. A one-time
   `YES_NO` alert that names the scan mode. The acknowledgement is stored as
   `linker_upload_acknowledged`, which is **not** in `SETTINGS`, so a client
   can't set it through `setPreferences`.
2. It opens `linker-results.html` straight away. That dialog calls
   `scanDocumentForReferences()`, so the user sees progress instead of a
   frozen menu.
3. `buildLinkerScanRequest_`: in **candidates** mode (the default),
   `buildLinkerScanPayload_` (`server/linker-prefilter.gs`) walks the body
   text line by line. It keeps lines that contain a known title, a
   `chapter:verse`, a daf (`2a`) or a Hebrew abbreviation, pads them, merges
   overlapping windows, and joins them with a separator, keeping a
   `segments` table that maps payload offsets back to document offsets. Prose
   with no citation never leaves the document. In **full** mode the whole body
   is sent. The limit is 100,000 characters, with an explicit error above it.
4. `findRefsInDocumentText`:
   `POST /api/find-refs?with_text=1&max_segments=1`, then it polls
   `GET /api/async/{task_id}` (12 × 400 ms). `with_text` returns `refData`
   (heRef, URL, excerpt) for every candidate in the same response. That's what
   lets the review table show excerpts without a request per row.
5. `classifyLinkerMatches_` is pure and unit-tested. Each raw match becomes
   exactly one of: **linked** (one ref), **ambiguous** (several refs, kept in
   Sefaria's order and never re-ranked), **unresolved** (`linkFailed` or no
   refs), **unplaceable** (resolved, but it spans two pre-filter windows, so no
   single run of document text holds it; the fix is Whole document mode), or
   **skipped** (already hyperlinked, and not counted as a failure). The
   original add-on linked `refs[0]` of ambiguous matches and reported only
   successes.
6. **Apply:** `applyLinkerDecisions(json)` sorts by `startChar` descending,
   so earlier offsets stay valid, and calls `setLinkUrl`. Per-row **Insert**
   calls `insertLinkedSourceAtPosition(ref, startChar)` for each row, also in
   descending order.
7. **Quiet** mode (`runQuietLinkPass_`) skips the dialog: it links the
   unambiguous matches and alerts with every count.

**Be upfront about the limits:** only the body is scanned (not headers,
footers or footnotes). Offsets come from the scan and aren't re-checked at
Apply time. And a find-refs task that takes longer than the polling window
comes back as an empty result. The stress walkthrough (K2–K4) turns these
into test steps.

**Show:** `test/tests/linker-prefilter.test.js` (what leaves the machine,
and the offset mapping) and `linker-classify.test.js`.

---

## 7. Preferences, and what a client is allowed to write (3 min)

**Do:** open ⚙︎ Preferences and change a font.

- `setPreferences(obj)` only stores keys listed in `SETTINGS`, as strings of
  at most 9,000 characters (`test/tests/set-preferences.test.js`). Any iframe
  can call any server function, so the server can't trust the client.
- `getPreferences()` / `getAccountPreferences()` read the same list back.
- Menu changes (the Menu Bar tab) take effect on the next `onOpen`, so the
  user has to reload the Doc.

---

## 8. Voices, Lexicon, Sheets (3 min)

| Feature | Endpoint | Note |
| --- | --- | --- |
| Voices search | `POST /api/search/sheet/_search` | Raw Elasticsearch DSL through an nginx allowlist. **Not a documented API**, and the most fragile dependency (`pre-upstream-review.md` §1.4). A good question to raise with Sefaria. |
| Sheet contents | `GET /api/sheets/{id}` | Sheets are user-generated. Every URL written into the Doc goes through `safeLinkUrl_` (http, https and mailto only). |
| Lexicon | `GET /api/words/{word}`, plus the search wrapper for English reverse lookup | `server/lexicon.gs` |

---

## 9. Guardrails and shipping (5 min)

```bash
npm ci && npm test                 # 197 passing, 0 skipped (skipped > 0 = linkedom missing = red)
bash pre_clasp_qc.sh apps-script   # must exit 0
npx --prefix tools/clasp clasp push  # HEAD only: test deployments, not users
```

What guards what:

| Guardrail | Catches |
| --- | --- |
| `docs/rpc-surface.json` + `test/ui/rpc-surface.test.js` | A server function renamed, removed or re-aritied while the client still calls it. The call would fail silently in production. |
| `selector-contracts.json` | DOM ids the server relies on, removed during UI work. |
| `template-snapshots.test.js` | Any byte change to an entry template. Regenerate with `UPDATE_UI_SNAPSHOTS=1`; never edit by hand. |
| `csp-coverage.test.js`, `embedded-json.test.js` | A dialog without the CSP; unescaped server data in an inline script. |
| `version-manifest.test.js` | `VERSION.json`, the schema number, the migrations and every user-visible version string agreeing with each other. |
| `pre_clasp_qc.sh` 9 / 9b | Any new `.innerHTML` or dynamic `.html()` without a justification comment. |

**Releasing:** `clasp push` updates HEAD, which only test deployments run.
Users run the numbered version selected in Marketplace SDK → App
Configuration. So a release means: live-test HEAD, `clasp version "v2.1.0"`,
then set that number in the SDK.

---

## 10. Debugging in a live session

- **Blank or dead sidebar:** check the console first. An SRI hash mismatch
  means jQuery didn't load and nothing works. A CSP violation names the
  blocked host.
- **Something did nothing:** find the call on the Executions page. No entry
  means the client never called it; look for a missing `withFailureHandler`
  or a renamed function.
- **Logs are deliberately thin.** `Logger.log` records error messages and
  function names, never preferences, document text or references typed by the
  user (hard rule 7). To diagnose, add a structured payload with known-safe
  fields; don't dump raw data.

## Questions Sefaria reviewers are likely to ask

- *Why v1 `/api/texts` and not v3?* It works and is maintained. Moving to v3
  is a real refactor (string `sections`, a `versions[]` shape), planned behind
  an adapter after the upstream merge. `pre-upstream-review.md` §1.2.
- *Why the raw sheet search proxy?* No documented sheet-search API exists. A
  supported one would be welcome.
- *What do you send?* What the user typed; plus, for the linker only, the
  candidate passages (or the whole body, if they choose that). `PRIVACY.md`.
- *What's stored?* Preferences in `UserProperties`, sidebar state in the user
  cache for 6 hours, and the Session Library in the browser. No credentials,
  no analytics.
