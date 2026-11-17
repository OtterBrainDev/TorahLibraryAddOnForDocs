# For Sefaria's review — and what is left if Sefaria publishes this

Written 2026-11-17 against the 2.0.0 release candidate (816 tests passing,
`pre_clasp_qc.sh` clean, preference schema 30).

This add-on grew out of *Sefaria for Google Docs* 1.0 (Shlomi Helfgot's code,
MIT). As it stands it is set up to be published by The Merkaz as a separate
add-on called **Torah Library**, installed beside Sefaria's. This file is for
the other outcome: **Sefaria takes the code and publishes it under its own
name.** It lists what Sefaria would need to decide, change and check.

Nothing here is a change request to the code as it is today. Sections 3 and 4
are the work; the rest is context for whoever reviews it.

---

## 1. The two ways to publish, and what each means for today's users

| | A. As the next version of *Sefaria for Google Docs* | B. As a new listing |
| --- | --- | --- |
| How | `clasp push` this code into the **Apps Script project behind the existing listing**, freeze a version, point the listing's Marketplace SDK → App Configuration at it | New script project, new Cloud project, new listing, new review |
| Today's users | **Upgraded in place.** They get it the next time they open a document. Nothing to install, no prompt, no way to stay on 1.0 | Nothing changes for them until they find and install the new add-on; both then sit side by side under **Extensions** |
| Their settings | Kept from then on (stored per user, per script project) | Start fresh |
| Google's review | A new script version normally needs none. Changed scopes or changed listing text do | Full review, including OAuth verification if Google asks for it |
| Rollback | Point App Configuration back at the previous version number | Unpublish |

**Path A is the only one that upgrades people without a new install**, and it
is only available to whoever owns the existing listing's script project — that
is, Sefaria. It cannot be done from The Merkaz's or OtterBrain's accounts.

### What path A needs, specifically

1. **The same script project.** Not a copy: user settings and the listing are
   both tied to the project's script ID.
2. **Scopes compared with 1.0's.** This code asks for exactly four
   (`apps-script/appsscript.json`):

   - `documents.currentonly`
   - `script.container.ui`
   - `script.external_request`
   - `script.storage`

   Any of these that 1.0 does not already have will make every user
   re-authorize once, and the add-on does not run for them until they do. Any
   scope 1.0 has that is not in this list can be dropped from the consent
   screen. **We have not seen 1.0's manifest, so this comparison is not done.**
   Changing scopes also means updating the OAuth consent screen and the
   Marketplace SDK scope list, which can trigger Google's verification.
3. **A decision about what an upgraded user sees first** (section 2).

### What an upgraded 1.0 user would experience (read from the code, not yet tested live)

- 1.0 stored no preferences, so on the first open after the upgrade the add-on
  finds no schema version, saves its defaults for that user, and runs its
  migrations (`runUserPreferenceMigrationsIfNeeded_` in
  `apps-script/migrations.gs`). The menu is rebuilt on that open.
- Because that user has no settings, they are treated as new: **the first-run
  setup dialog opens the first time they open the sidebar**
  (`apps-script/server/first-run.gs`, called from `server/menu.gs`). Its first
  screen offers *"I've used Sefaria for Google Docs"*, which starts them on
  1.0's look: both languages, Hebrew on the right, the Simple interface.
- Two defaults differ from 1.0 and would reach every upgraded user unless
  changed first: **divine names are replaced as a source is inserted**
  (יהוה → יי), and **each source gets a credit line** naming the edition and
  its license.
- Documents written with 1.0 are untouched. Transform Divine Names, Link Texts
  and Unlink Sources work on text 1.0 inserted.

The live test checklist (`docs/live-test-checklist-2.0.0.md`) covers a 1.0
user who installs Torah Library *beside* 1.0 (its "Account C"). **It has no
in-place upgrade run.** Before path A goes to users, push this code to a copy
of the 1.0 project's state, open a document as a user who has only ever had
1.0, and confirm the bullets above.

---

## 2. Decisions that are Sefaria's to make

| # | Decision | Where it lives now |
| --- | --- | --- |
| 1 | **Name.** Keep "Sefaria for Google Docs", or adopt "Torah Library" | Section 3 lists every place |
| 2 | **Divine-name substitution on insert, on by default.** 1.0 only changed names when asked | `getDefaultPreferences()` in `apps-script/server/preferences.gs`; the first-run dialog also asks |
| 3 | **Credit line under each source, on by default** | Same; pinned by `test/tests/source-attribution.test.js` |
| 4 | **First-run setup for upgraded users** — show it (as the code does now), or mark it done for anyone coming from 1.0 so they are not interrupted | `first_run_setup` in `server/first-run.gs`; a change needs a migration and a test |
| 5 | **Simple or Everything interface as the starting point** | `ui_mode`; setup's last screen |
| 6 | **Feedback.** The form is already Sefaria's Formstack form; under Sefaria's name that is simply correct. Decide whether support email should also be Sefaria's | `apps-script/feedback-modal.html`, Help → Support |
| 7 | **Experimental features** (Surprise Me, off by default, behind Preferences → 🧪) — ship, or remove before publishing | `server/` Surprise Me code, `shared/surprise-me` |
| 8 | **Terms of service.** `docs/TERMS.md` is a draft with a `[publisher legal name]` placeholder. Use Sefaria's own terms, or have this reviewed | `docs/TERMS.md` |
| 9 | **Who maintains it**, and where issues go | — |

If the answer to 1 is "Sefaria for Google Docs", two items that are open
questions for a third-party publisher simply close: the sidebar title is
already `'Sefaria'` and the footer already shows Sefaria's logo.

---

## 3. What to change to publish under Sefaria's name

All of it is text and configuration; none of it touches how the add-on works.

### In the add-on (`apps-script/`)

| What | Where |
| --- | --- |
| Add-on name `Torah Library` | `appsscript.json` (`addOns.common.name`); must match the listing and the OAuth consent screen exactly |
| Manifest logo, hosted on `the-merkaz.org` | `appsscript.json` (`logoUrl`) — point it at a stable Sefaria URL |
| "Torah Library" in the interface | `help-modal.html` (25 places), `first-run-setup.html` (4), `release-notes.html` (3), `first-run-setup/js.html`, `css/tokens.html` (a comment), the dialog title in `server/first-run.gs`, one error message in `server/settings-file.gs` |
| Support address `help@the-merkaz.org` | `help-modal.html`, `release-notes.html` |
| Privacy-policy and GitHub links to `TheMerkazDev/TorahLibraryAddOnForDocs` | `help-modal.html`, `preferences.html`, `release-notes.html` |
| "Maintained by…" and "this add-on is not made by Sefaria" wording | `help-modal.html` → About; the README |
| The *Coming from Sefaria for Google Docs* Help topic and Release Notes, which describe a separate add-on installed beside 1.0 | `help-modal.html`, `release-notes.html` — rewrite as "what's new in this version" |
| Settings-file marker | `server/settings-file.gs` — check what an exported file is tagged with before renaming, so files exported earlier still import |

The MIT copyright headers (Shlomi Helfgot; modifications Austin Swafford) and
`LICENSE.md` stay as they are.

### In the repository

| What | Where |
| --- | --- |
| Privacy policy: publisher, contact, repository link, and the sentence that the add-on is independent of Sefaria | `docs/PRIVACY.md` (§1, §9). §2 — what is sent, to whom, and when — is accurate as written and should not need changes |
| Terms | `docs/TERMS.md` (decision 8) |
| Listing copy, which ends "It is not made by Sefaria" | `docs/marketplace-listing.md` §3 |
| Store icons and banner (a ס with an arrow over "Torah Library") | `docs/store-assets/` — replace with Sefaria's, or keep |
| README, walkthroughs, live test checklist | `README.md`, `docs/walkthroughs/`, `docs/live-test-checklist-2.0.0.md` (rows M2, M3 name the TheMerkazDev repository) |
| Version: this is 2.0.0 following 1.0.0, which already fits an in-place upgrade | `docs/VERSION.json` |

### Tests to expect after renaming

Four test files hold the current name or addresses: the snapshots
`test/ui/snapshots/preferences.html.snap` and `first-run-setup.html.snap`
(regenerate with `UPDATE_UI_SNAPSHOTS=1 npm test`, never by hand),
`test/tests/settings-file.test.js` and `test/tests/first-run-setup.test.js`.
`test/ui/help-links.test.js` will catch a Help topic renamed without its
links. Finish with `npm ci && npm test` (0 failing, **0 skipped**) and
`bash pre_clasp_qc.sh apps-script` (exit 0).

---

## 4. Publishing checklist for Sefaria

- [ ] Decisions in section 2 made; section 3 applied; tests and QC green
- [ ] 1.0's scopes compared with the four above (section 1)
- [ ] Deploy target set. `.clasp.json` holds the OtterBrainDev development
      project's script ID and must not be used. Either run `clasp` by hand
      against Sefaria's project, or set the repository variable
      `CLASP_SCRIPT_ID` and the secret `CLASP_TOKEN`
      (`.github/workflows/deploy.yml`, `tools/clasp/README.md`). The workflow
      does nothing until both exist
- [ ] `clasp push` to the project's HEAD, then **Deploy → Test deployments**
- [ ] `docs/live-test-checklist-2.0.0.md` run against that test deployment,
      plus the in-place upgrade run described in section 1
- [ ] Privacy policy and terms published at URLs Sefaria controls; the in-app
      links, the OAuth consent screen and the listing all point to the same
      ones
- [ ] OAuth consent screen and Marketplace SDK scope list match the manifest
- [ ] Listing text and screenshots updated (a listing change goes through
      Google's review; a version change alone normally does not)
- [ ] `docs/VERSION.json` set to `released` with the date, the same date in the
      `docs/CHANGELOG.md` heading, commit tagged `v2.0.0`
- [ ] `clasp version "v2.0.0"`, then that version number in Marketplace SDK →
      App Configuration → **Save**. This is the moment users get it
- [ ] The previous version number written down, for rollback

`docs/marketplace-listing.md` has every console field and the release
procedure in full.

---

## 5. For the code and security review

**What the add-on can reach.** Only the open document, through
`documents.currentonly`. No Drive, no other documents, no email address or
profile (`grep -rn "getActiveUser\|getEffectiveUser\|getEmail" apps-script/`
is empty).

**Where data goes.** Every server request (10 `UrlFetchApp.fetch` calls and 2
`fetchAll`) goes to `www.sefaria.org`; user input is URL-encoded. There is no
server of the publisher's, no account and no analytics. *Link Texts with
Sefaria* is the one feature that sends document text: by default only passages
that look like they hold a citation, after a one-time confirmation. Details:
`docs/PRIVACY.md` §2.

**What the pages load.** jQuery 3.7.1 from Google's CDN with a Subresource
Integrity hash, Google's add-on stylesheet, Google Fonts, Sefaria's logo, and
Sefaria's Formstack form when *Send Feedback* is opened. Every page carries
the same Content-Security-Policy (`test/ui/csp-coverage.test.js`). Nothing
under `apps-script/` depends on a package.

**Untrusted markup.** Text from Sefaria, including search highlights and
source-sheet excerpts that members of the public write, is treated as
untrusted. Markup that is rendered goes through an allowlist sanitizer
(`sanitizeSourceHtml`, `apps-script/shared/ui/dom.html`: inline typography
only, `class`/`dir`/`lang` only, re-parsed to detect mutation); everything
else is escaped. On 2026-11-17 it was run against 18 mutation-XSS payloads in
headless Chromium: no script ran, no request was made, nothing outside the
allowlist survived. Every `.innerHTML` and jQuery `.html()` write carries a
justification comment, enforced by `pre_clasp_qc.sh` checks 9 and 9b.

**Links written into the document** are Sefaria URLs the add-on builds, or
pass `safeLinkUrl_` (`apps-script/server/sheets.gs`).

**Storage.** `UserProperties` holds display and insertion settings only; no
credential and no document text. Session state is in `CacheService`.
Preference writes from the client are limited to known keys
(`test/tests/set-preferences.test.js`); a settings-file import writes only
known keys with valid values.

**Logging.** Error messages and function names only, to Apps Script's
execution log, visible to the script's owner (`docs/PRIVACY.md` §4).

**Install and open.** `onOpen` builds a default menu without reading
preferences in `AuthMode.NONE`; `onInstall` builds the menu at once, so it
appears without a reload (`apps-script/triggers.gs`,
`test/tests/triggers.test.js`).

**The Sefaria API surface in use**: `/api/v3/texts/`, `/api/name/`,
`/api/index/titles/`, `/api/search-wrapper/es8`, `/api/search/sheet/_search`,
`/api/sheets/`, `/api/words/`, `/api/find-refs` with `/api/async/`. Sefaria is
best placed to say whether any of these should be called differently;
`docs/pre-upstream-review.md` §1 has the earlier notes.

**Known and accepted.** The pinned deploy tool, clasp 2.4.2, has 10 open npm
advisories in its dependency tree (6 high, 4 moderate). It runs only in the
deploy job and never reaches users, but that job holds a Google credential.
It is installed from a lockfile with integrity hashes and install scripts
disabled. Moving to clasp 3 is the fix; `tools/clasp/README.md` explains what
changes with it.

**Not verified here.** No live call to Sefaria's API or to `the-merkaz.org`
was possible from the review environment, and nothing in this file has been
tested against the real 1.0 script project.

**Where to read more**: `docs/architecture.md` (server/client boundary,
storage, the RPC surface), `docs/rpc-surface.json` (every function the pages
can call), `docs/regression-log.md`, `docs/pre-upstream-review.md` (the
2026-08 review and what was fixed).
