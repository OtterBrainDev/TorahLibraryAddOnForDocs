# Pre-upstream review — Torah Library Add-On

Review performed 2026-08-28, ahead of proposing this fork to the upstream
owner. Scope: (1) Sefaria API currency, (2) OAuth scope minimality,
(3) a full code review at the standard of "this ships to tens of thousands
of users", (4) security.

Verification note: `developers.sefaria.org` is unreachable from the review
environment (egress-blocked), as is `www.sefaria.org` itself — so **no live
API call was made**. Every API claim below is instead taken from Sefaria's
own source of truth: a fresh clone of `Sefaria/Sefaria-Project`, reading
`sefaria/urls_shared.py` (the routing table), `reader/views.py`, `api/views.py`,
and `helm-chart/sefaria/conf/nginx.template.conf.tpl`. That is stronger
evidence than the docs site for *what exists*, but it does not tell us
Sefaria's deprecation **timeline**. Before acting on §1.2, confirm against
the developer portal from a machine that can reach it.

---

## 0. Blockers — resolve before pushing upstream

### 0.1 `.github/workflows/deploy.yml` must not go upstream as-is

This is the single highest-risk item in the diff, and it is not a code bug.

```yaml
on:
  push:
    branches: [master, claude/appscript-github-sync-EOqjD]
...
- run: clasp push -f
```

Three problems, in ascending severity:

1. **It deploys without running tests.** The `deploy` job has no `needs:` on
   the `test` workflow. A red `master` pushes straight to production. Note
   that `master` was in fact red when this review started (§3.6).
2. **A personal, stale branch name is a production deploy trigger.** Anyone
   who can push `claude/appscript-github-sync-EOqjD` deploys to the live
   Apps Script project.
3. **`.clasp.json` pins `scriptId: 1XwzPFFHwcNdTIlCkQa5zxPwDfur4XWQPfSYUMlm0-CYOw33dr0TL_PlL`
   — this fork's own Apps Script project.** If the upstream owner merges this
   PR, they inherit a workflow that, on every push to *their* `master`, tries
   to `clasp push -f` *their* code into *this fork's* script project. It will
   fail on the missing `CLASP_TOKEN` secret rather than succeed — but it is a
   confusing, wrong-by-default artifact to hand a maintainer, and if they ever
   add a `CLASP_TOKEN` of their own it silently starts deploying to the wrong
   place.

**Recommendation:** drop `deploy.yml` and `.clasp.json` from the upstream PR
entirely, or gate the deploy on `if: github.repository == 'OtterBrainDev/TorahLibraryAddOnForDocs'`.
Deployment wiring is fork-local infrastructure, not a feature contribution.
Separately, for this fork: add `needs: test`, remove the personal branch, and
pass the secret via `env:` rather than interpolating `${{ secrets.CLASP_TOKEN }}`
into a shell line.

### 0.2 There is no privacy policy, and one feature is not disclosed

`grep -ri privacy` across the repository returns nothing.

The Google Workspace Marketplace **requires** a privacy policy URL, and OAuth
verification will ask specifically what leaves the user's document. One feature
makes that a substantive question rather than a formality:

**"Link Texts with Sefaria" transmits the entire document body to a third
party.** `linkTextsWithSefaria()` calls `DocumentApp.getActiveDocument().getBody().getText()`
and POSTs the whole string to `https://www.sefaria.org/api/find-refs`
(`sefaria-fetch.gs:40`). That is correct and necessary for the feature to
work — it is how Sefaria's linker is designed — but the user is never told.
Today the only description is README's "*a document-level action for turning
recognizable references in the current Doc into Sefaria hyperlinks*", which
does not convey that the text is uploaded.

**Recommendation, in priority order:**

- Publish a privacy policy covering: what is sent to sefaria.org, that no
  data is sent anywhere else, that preferences live in Google's
  `PropertiesService` (per-user, per-add-on), and that no credentials are
  stored. Link it from the Marketplace listing and from Help & Support.
- Add a one-time confirmation, or at minimum an explicit line in the
  Help modal and the menu item's description, before the first
  "Link Texts with Sefaria" run.
- Consider chunking: there is no size guard on the upload today, so a long
  document is one very large POST (§3.7).

---

## 1. Sefaria API review

### 1.1 What the add-on calls today

Every endpoint the add-on uses still exists in Sefaria's current routing
table. **Nothing is broken, and nothing is removed.** Two are non-current.

| Endpoint | Used by | Status |
| --- | --- | --- |
| `POST /api/find-refs` + `GET /api/async/{task_id}` | linker | **Current.** This is the modern async pattern (`find_refs_api` returns `202` + `task_id`). Good. |
| `GET /api/texts/{tref}` | `findReference` — the core path | **Legacy (v1).** Live and maintained, but v3 is the current text API. See §1.2. |
| `POST /api/search-wrapper` | text search, lexicon reverse-lookup | **Legacy compat shim.** See §1.3. |
| `POST /api/search/sheet/_search` | Voices (source-sheet search) | **Undocumented raw Elasticsearch proxy.** See §1.4. |
| `GET /api/name/{name}` | reference autocomplete | Current. |
| `GET /api/words/{word}` | Lexicon | Current. |
| `GET /api/index/titles` | title list | Current. |
| `GET /api/sheets/{id}` | sheet contents | Current. |

### 1.2 `/api/texts/` (v1) → `/api/v3/texts/` — recommended, but not a drop-in

`api/views.py:Text` is the v3 endpoint. It offers three things the add-on
would genuinely benefit from:

- **Repeatable `version` parameter.** `request.GET.getlist('version')` — you
  can request N versions in **one** request. Today `insertReferenceVersions()`
  (`insertion.gs`) fires **one `/api/texts/` request per selected translation**
  in a `.map()`. For the multi-select-translations feature this is the single
  biggest available win: N round-trips collapse to 1. That matters at scale —
  Apps Script enforces both a `UrlFetchApp` daily call quota and a 6-minute
  execution ceiling, and the add-on is currently spending both linearly.
- **`return_format=text_only` / `strip_only_footnotes`.** Server-side removal
  of footnote and markup noise. The add-on hand-rolls this today in
  `insertRichTextFromHTML` and `htmlToPlainText_`.
- **`fill_in_missing_segments`.** Cleaner handling of ranged refs.

**But migration is a real refactor, not a URL swap.** Two traps:

1. **`sections` become strings.** `text_request_adapter.py:99` sets
   `'sections': oref.normal_sections()`, with Sefaria's own inline comment
   noting that v1 returned integers for everything except Talmud. The add-on
   does `fromVerse + index` in `formatDataForPesukim`. With a string,
   `"5" + 1 === "51"` — verse numbering would break silently and look like a
   formatting bug. (This review already hardened that line with `Number()`,
   which incidentally de-risks the migration.)
2. **`he` / `text` are replaced by a `versions[]` array.** Every consumer of
   `data.he` and `data.text` — insertion, preview, transliteration,
   divine-name replacement, Hebrew display filters — reads the v1 shape.

**Recommendation:** worth doing, but as its own PR *after* the upstream merge,
behind an adapter that normalizes a v3 response into the existing v1-shaped
object. Do not bundle it with this change set.

### 1.3 `/api/search-wrapper` is pinned to the Elasticsearch 6 compat shim

From `sefaria/urls_shared.py:196-198`:

```python
path('api/search-wrapper/es6', reader_views.search_wrapper_api, {'es6_compat': True}),
path('api/search-wrapper/es8', reader_views.search_wrapper_api),
path('api/search-wrapper',     reader_views.search_wrapper_api, {'es6_compat': True}),
```

The **bare path the add-on uses defaults to `es6_compat=True`** — it is the
legacy alias. `/es8` is the current one. Practically the only difference is
that the shim flattens `hits.total` from `{value: N}` to `N`, and the add-on
only ever reads `hits.hits`, so **switching is safe today and low-value today**
— but the bare alias is the one most likely to be retired.

**Recommendation:** low-risk one-line change to `/api/search-wrapper/es8` in
`search.gs:39`, worth doing now precisely because it is cheap.

### 1.4 `/api/search/sheet/_search` bypasses Sefaria's API entirely

This one deserves attention. It appears **nowhere** in Sefaria's Django
routing. It is served by an nginx rule
(`helm-chart/sefaria/conf/nginx.template.conf.tpl:90-100`) that allowlists
four index names and proxies **straight through to Elasticsearch**:

```nginx
location ~ ^/api/search/(?!(text|sheet|merged|merged-c)(/_search|/_analyze)/?) { return 403; }
location /api/search/ { proxy_pass http://elasticsearch_upstream/; }
```

So `searchVoices()` is sending raw Elasticsearch Query DSL to Sefaria's search
cluster. It works, it is deliberately allowlisted, and it is not "abuse" — but
it is an **unversioned, undocumented internal surface with no compatibility
promise**. Sefaria has already migrated ES6→ES8 once (that is *why* the
`es6_compat` shim exists). The next such migration can change query semantics
or response shape with no API-deprecation notice, because from Sefaria's
perspective this was never an API.

**Recommendation:** treat Voices as the add-on's most fragile feature.
Wrap `searchVoices` in a defensive try/catch that degrades to a clear
"Voices search is temporarily unavailable" (it partly does — but the fallback
is an exception, not a graceful empty state), and raise it with Sefaria as a
"can this become a supported endpoint?" question. Do not build more on it.

### 1.5 Features available cheaply from endpoints not currently used

Ordered by value-to-effort:

| Endpoint | What it enables | Note |
| --- | --- | --- |
| `GET /api/bulktext/{ref1\|ref2\|...}` | Batch text fetch. Sefaria's own docstring: *"Used by the linker."* | **Direct fit.** The insert-after-linking flow calls `findReference()` once per ref in a loop. This is the endpoint designed for exactly that. |
| `GET /api/texts/random?categories=A\|B` and `/api/texts/random-by-topic` | "Surprise Me" | Currently Surprise Me picks a random dictionary word, runs a **full search**, then fetches each hit individually — up to 5 retry rounds. A purpose-built random endpoint replaces all of it. |
| `GET /api/words/completion/{word}[/{lexicon}]` | Lexicon autocomplete | The Lexicon tab has no completion today. `library.cross_lexicon_auto_completer()` backs it; `?limit=` supported. |
| `GET /api/related/{tref}` | One call returning `links`, `sheets`, `topics`, `manuscripts`, `media`, `guides` for a ref | Would power a "related sources" panel next to the preview. Highest *product* upside on this list. |
| `GET /api/calendars` | Daily learning (Parashat Hashavua, Daf Yomi, …) | Natural fit for a Torah-study add-on; nothing like it exists today. |
| `GET /api/texts/translations/{lang}` | Enumerate available translations per language | Would let `preferred_translation_language` present real choices instead of a fixed LUT. |
| `GET /api/v3/texts/...?version=…&version=…` | Multi-version in one request | See §1.2. |

None of these are required for the upstream push. §1.5 is a roadmap, not a
blocker.

---

## 2. OAuth scopes — clean, and defensibly minimal

```json
"oauthScopes": [
  "https://www.googleapis.com/auth/documents.currentonly",
  "https://www.googleapis.com/auth/script.container.ui",
  "https://www.googleapis.com/auth/script.external_request",
  "https://www.googleapis.com/auth/script.storage"
]
```

All four are load-bearing, and each is the narrowest scope that does its job:

| Scope | Justified by | Could it be narrower? |
| --- | --- | --- |
| `documents.currentonly` | 61 `DocumentApp` call sites | No — this is already the restricted variant. It grants access **only to the document the add-on is open in**, never the user's Drive. This is the right choice and worth stating explicitly in the Marketplace listing. |
| `script.container.ui` | menus, sidebar, modal dialogs | No. |
| `script.external_request` | 10 `UrlFetchApp` call sites (all `sefaria.org`) | No. |
| `script.storage` | 16 `PropertiesService` call sites | No. |

**The de-AI scope cleanup is complete and verified.** `userinfo.email` was
dropped with the AI feature; there is no `Session.getActiveUser()`,
`getEffectiveUser()`, or `getEmail()` anywhere in `apps-script/`. The
`reference/ai-lesson/` tree is excluded from deployment by `.claspignore`,
and `migrateToV3_` actively deletes the 13 stale `ai_*` UserProperties keys —
including three that had held plaintext API keys — on first open after upgrade.
That is genuinely good hygiene and worth calling out to the upstream owner.

**One latent scope risk, now fixed:** `releaseNotesPopup()` called
`SpreadsheetApp.getUi()` in a Docs-only add-on (`menu.gs:163`). It is dead
code — nothing in the menu, the RPC surface, or any client HTML calls it — so
it never threw in production. But it was the **only** construct in the project
that could cause a Sheets scope to be inferred if the manifest were ever
regenerated. Changed to `DocumentApp.getUi()`.

**No credential is stored anywhere.** Confirmed against hard rule #4: no
`PropertiesService` key holds a secret, and `CacheService.getUserCache()` backs
the only session state.

---

## 3. Code review

Findings are ordered by severity. **[fixed]** means this review changed it;
**[documented]** means it needs a decision I should not make unilaterally.

### 3.1 [fixed] Unvalidated third-party URLs became live hyperlinks — *medium*

`renderSheetSource_()` in `sheets.gs`:

```js
const mediaUrl = String(source.media).trim();
...
mediaParagraph.editAsText().setLinkUrl(mediaUrl);
```

`source.media` comes from `fetchSefariaSheetById_()` — i.e. **arbitrary
user-generated content**. Anyone can publish a Sefaria source sheet, and a
media node's URL was written into the victim's Google Doc as a clickable link
with no scheme check at all: `javascript:`, `data:text/html`, or a plain
phishing URL. `insertSheetReferenceBlock_()` had the same issue with a
client-supplied `sheetPayload.url`.

Google Docs does its own link sanitization on click, which is why I rate this
medium rather than high — but "the downstream renderer probably saves us" is
not a control, and a link the user did not choose landing in their document is
the actual defect.

Both now route through a new `safeLinkUrl_()`: `http:` / `https:` / `mailto:`
only, and rejects any value containing control or whitespace characters (the
usual way a blocked scheme is smuggled past a naive prefix test). Values that
fail still render as **visible text**, so nothing silently disappears from the
sheet.

### 3.2 [documented] Sefaria text HTML is rendered raw into the sidebar — *medium, needs a decision*

`preview-core.html:247` → `$('.suggestions').html(renderPreviewHTML(dataIn, inputTitle))`,
and `renderPreviewHTML` interpolates `dataIn.he` and `dataIn.text` **unescaped**.

This is *intentional and currently necessary*: Sefaria library texts legitimately
contain `<b>`, `<i>`, `<sup>` and footnote markup, and the preview is supposed
to show it. The corpus is editorially controlled, so this is not an
exploitable-today finding.

It is still a stored-XSS sink with a real privilege boundary behind it. The
sidebar iframe holds `google.script.run`, so script execution there can invoke
**any** function in `docs/rpc-surface.json` — including `insertReference`,
`setPreferences` and `setAccountPreferences` — against the user's live document.
The blast radius is larger than "a popup in a sidebar".

**Recommendation (not applied — it is a product decision about preview
fidelity):** run `dataIn.he` / `dataIn.text` through a small allowlist
sanitizer before rendering — permit `b, i, em, strong, sup, sub, br, span, small`
with no attributes except a fixed `class` — and drop everything else. This
preserves every formatting feature Sefaria actually uses and closes the sink.
I did not apply it because it changes preview rendering and deserves a visual
check against real footnoted texts (Talmud, Rashi) before it ships.

### 3.3 [fixed] The `.innerHTML` guardrail had a hole the size of jQuery

`pre_clasp_qc.sh` check 9 enforces a justification comment on every
`.innerHTML =` write — a good rule, and the CHANGELOG treats it as *the*
XSS guardrail. But it greps for `.innerHTML` only, and the codebase writes
DOM almost exclusively through jQuery's `$(sel).html(x)`, which is the same
sink. **~30 `.html()` calls were invisible to it**, including 3.2 above.

Added check **9b**, applying check 9's standard to dynamic `.html()` writes
(calls whose sole argument is a string literal are static markup and skipped).
It reports at **WARN, not FAIL** — 16 pre-existing sites would otherwise turn
CI red, and annotating them correctly requires per-site review that is out of
scope here. The count is now visible and can be burned down.

### 3.4 [fixed] Two sources of truth for preference defaults — *medium*

Directly against hard rule #1. `onInstall` in `triggers.gs` seeded a
**hand-maintained literal** rather than calling `getDefaultPreferences()`.
The two had drifted:

- `onInstall` **omitted ~14 keys** entirely (`elodim_replacement`,
  `insert_citation_default`, `link_texts_default`,
  `link_sources_insert_after_linking`, `meforash_replacement`,
  `yaw_replacement`, all six `source_title_*` / `sefaria_link_*` keys,
  the four `last_*` search-state keys).
- They **disagreed on values**: `translation_font_size` 11 vs 12,
  `transliteration_font_size` 11 vs 12. A fresh install and a
  reset-to-defaults produced differently formatted documents.
- `onInstall` never stamped `prefs_schema_version`, so every new install
  re-ran the full migration chain on its first `onOpen`.

Now: `Object.assign({}, getDefaultPreferences(), getFreshInstallPreferenceOverrides_())`,
where the overrides function holds exactly the two deliberate fresh-install
differences (`apply_sheimot_on_insertion: true`, `meforash_replace: true`) with
a comment explaining why they are not simply the defaults — flipping them in
`getDefaultPreferences()` would silently enable divine-name substitution for
existing users who turned it off, which is the mirror image of the original
regression. The schema version is now stamped.

**One user-visible consequence, called out deliberately:** new installs now get
12pt translation/transliteration text instead of 11pt. I converged on the
documented defaults rather than preserving the drift. If 11pt was intentional,
move it into `getFreshInstallPreferenceOverrides_()`.

Separately, `experimental_features_enabled` is listed in `SETTINGS` and read by
`mode-controller.html` but had **no entry in `getDefaultPreferences()`**, so it
resolved to `undefined`. It failed closed, so no bug — but it is the same
class of gap. Added as `false`.

### 3.5 [fixed] Migration version chain was correct by accident

`runUserPreferenceMigrationsIfNeeded_()` gated migrations with chained
inequalities: `if (current !== '3' && current !== '4')`, then
`if (current !== '4' && current !== '5')`, then `if (current !== '5')`.

Traced against every reachable version this **does** produce correct behavior
today. But it requires editing two conditions for every new version, and the
final guard re-runs the newest migration for any version *above* it. For the
one mechanism whose entire job is protecting existing users through upgrades,
"correct by accident" is the wrong property. Replaced with numeric
`from < N` comparisons; unparseable/absent version means "oldest", so
everything runs.

### 3.6 [fixed] `npm test` was red on the branch

`test/ui/template-snapshots.test.js` failed on `preferences.html`. Root cause:
the snapshot was **hand-edited** (`4a58f3f`, +17 lines) instead of being
regenerated, so it never captured two other changes from `456d378` — a
`&ldquo;` entity, and an accidental de-normalization of the Hebrew preview
string away from NFC (`ש` + sin-dot + patah, where canonical order is
patah then sin-dot).

Fixed by restoring the Hebrew line to its NFC form (reverting churn that was
not intentional) and regenerating the snapshot properly. Net diff: two lines.
47/47 now pass.

Worth noting for the process: `CLAUDE.md` says "Expected: 30 passing" — it is
47. The doc also references `Code.gs`, which no longer exists (split into
`server/*.gs`), and `docs/regression-log.md` cites `test/tests/migrations.test.js`
and two others as if they were aspirational, when all three exist and pass.
Minor, but a contributor guide that misstates the test count is a guide people
stop trusting.

### 3.7 [documented] Robustness gaps worth a follow-up

- **No size guard on the linker upload.** `linkTextsWithSefaria()` POSTs the
  entire document body with no length check. A book-length doc is one very
  large request against Apps Script's `UrlFetchApp` payload limit, and the
  poll loop gives up after ~4.8s (12 × 400ms) regardless of document size —
  so large documents likely fail with an empty result and no explanation.
  Chunking, or at minimum a length check with an honest error, is needed.
- **N+1 fetches on two paths.** `insertReferenceVersions` (one request per
  version) and Surprise Me (search + one request per hit, up to 5 rounds).
  Both have purpose-built endpoints available — §1.2 and §1.5.
- **`findReference` swallows every failure identically.** One try/catch wraps
  fetch + JSON parse + all three preference passes, returning bare `undefined`.
  A network blip, a 404, and a malformed payload are indistinguishable to the
  caller and to the user. The file's own TODO comments already flag this.

### 3.8 [documented] Correctness quirks — behavior changes, so not applied

These are pre-existing, opt-in, and changing them would alter output for users
who rely on current behavior. Flagging rather than fixing:

- **`yaw_replace` is over-broad.** The pattern `/י[֑-ׇ]*ה[֑-ׇ]*/g`
  (`text-processing.gs:85`) matches *any* yod followed by heh — with no word
  boundary. On `יהודה` it produces `קהודה`. Note the document-level
  equivalent in `document-actions.gs:108` **is** correctly wrapped in
  non-Hebrew boundaries. The insertion path should almost certainly use the
  same boundary treatment; confirm the intended semantics first.
- **Replacement strings are interpreted as `String.replace` patterns.**
  `current.replace(rule.pattern, rule.replacement)` (`text-processing.gs:108`)
  means a user whose `meforash_replacement` preference contains `$&` or `$1`
  gets substitution-pattern expansion rather than a literal. Self-inflicted
  only, but a one-line fix (`replacement.replace(/\$/g, '$$$$')`).
- **Nekudot stripping also removes punctuation.** The `[ֿ-ׇ]` range
  (`text-processing.gs:42`) includes paseq (U+05C0) and sof pasuq (U+05C3),
  which are punctuation, not vowels.

### 3.9 Things that are genuinely good

Worth saying explicitly, because the upstream owner will want to know what
they are getting:

- The guardrail set — `rpc-surface.json` enforced **bidirectionally**,
  selector contracts, include-graph-aware duplicate detection, byte-for-byte
  template snapshots — is better than most production codebases of this size,
  and `docs/regression-log.md` is a genuinely unusual artifact in the right way.
- The AI detachment was done *properly*: scope dropped, code excluded from
  deploy, **and** a migration that actively deletes the stale plaintext keys
  from existing users' storage.
- `documents.currentonly` over `documents` is the right call and is the single
  best thing on the consent screen.
- `unlinkSefariaSources()`'s host regex correctly rejects `notsefaria.org` and
  `evil.com@sefaria.org` — someone thought about it.
- The comment on `resolveSafeSelectionInsertionIndex` explaining why
  `getType()` is used instead of reference equality (Apps Script proxy objects
  for the same Body are not `===`) is exactly the kind of comment that saves
  the next person a day.

### 3.10 [fixed] Smaller defects

- **Duplicate menu item.** With **Pin "Insert from Selection" at top** enabled,
  `buildAndInstallMenu()` added the item at the top *and* kept the
  unconditional one below it. The second is now suppressed when pinned.
- **Entity decoding before tag stripping.** `htmlToPlainText_()` decoded
  `&lt;`/`&gt;` *before* running `<[^>]+>` — so an escaped `a &lt; b &gt; c`
  decoded to `a < b > c` and the tag-stripper then **ate `< b >`**, silently
  deleting the author's text. Tags are now stripped first, and `&amp;` is
  decoded last so `&amp;lt;` no longer double-decodes.
- **Unguarded `sections` read.** `formatDataForPesukim` did
  `data["sections"][1]` with no guard and threw on payloads that carry no
  `sections` (dictionary entries, some complex book-level refs) —
  `insertion.gs:323` already guarded the identical read. Now guarded, and
  wrapped in `Number()`, which also pre-empts the v3 string-sections trap (§1.2).
- **Loose hostname check.** `parseSefariaUrlInput()` used
  `host.indexOf('sefaria.org') < 0`, accepting `sefaria.org.evil.example`
  and `notsefaria.org.attacker.net`. Now requires the host to be `sefaria.org`
  or a true subdomain, over http/https only.

---

## 4. Suggested sequencing

**Before the upstream PR**

1. Resolve §0.1 — drop or gate `deploy.yml` / `.clasp.json`.
2. Resolve §0.2 — privacy policy, and disclose the linker upload.
3. Decide §3.2 — sanitize preview HTML, or accept and document the risk.
4. Correct the stale numbers in `CLAUDE.md` / `AGENTS.md` (§3.6).

**Cheap wins, any time**

5. `/api/search-wrapper` → `/api/search-wrapper/es8` (§1.3).
6. Size guard + honest error on the linker upload (§3.7).
7. Decide the `yaw_replace` boundary question (§3.8).

**Follow-up PRs, after the merge**

8. `/api/bulktext` for insert-after-linking; random endpoints for Surprise Me (§1.5).
9. v3 texts behind a response adapter (§1.2).
10. Burn down the 16 check-9b warnings (§3.3).
