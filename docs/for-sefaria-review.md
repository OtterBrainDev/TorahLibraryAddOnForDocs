# For Sefaria's review — and what is left if Sefaria publishes this

Written 2026-11-17 against the 2.0.0 release candidate (816 tests passing,
`pre_clasp_qc.sh` clean, preference schema 31).

Current source update, 2026-11-24: the v3, Commentary/Notes and launch-defaults
changes are recorded in [the project handoff](sefaria-api-migration.md).
The current schema is 33; the date and test count above describe the original
review. Deployment and release approval remain separate.

This add-on grew out of *Sefaria for Google Docs* 1.0 (Shlomi Helfgot's code,
MIT). It was first set up to be published by The Merkaz as a separate add-on
called Torah Library. **As of 2026-11-20 it is named Sefaria for Google Docs
and links to Sefaria's Help Center, privacy policy and terms**, ready for the
other outcome: Sefaria takes the code and publishes it under its own name.
This file lists what Sefaria would still need to decide, change and check.

**Until Sefaria approves it, this build must not be published from any other
account**: it carries Sefaria's name and links.

Section 3 says what the rename covered and what is left; section 4 is the
publishing work; the rest is context for whoever reviews it.

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
2. **One new permission, and so one re-authorization.** The public listing
   for 1.0 (read 2026-11-17) declares five scopes; this code asks for four:

   | Scope | 1.0 listing | This code |
   | --- | --- | --- |
   | `documents.currentonly` | yes | yes |
   | `script.container.ui` | yes | yes |
   | `script.external_request` | yes | yes |
   | `script.storage` | **no** | **yes** |
   | `userinfo.email` | yes | no |
   | `userinfo.profile` | yes | no |

   - **`script.storage` is new.** It is what lets the add-on keep a user's
     settings, which 1.0 never did. Every one of the listing's 53,000+ users
     would be asked to authorize once, and the add-on does not run for them
     until they do. There is no way to add the scope silently. The only way
     to avoid the prompt is to ship without saved settings, which removes
     most of what 2.0 adds.
   - **`userinfo.email` and `userinfo.profile` can go.** This code never reads
     the user's address or profile. Dropping them lets the consent screen say
     less than it does today, which is worth saying in the release notes next
     to the new prompt.
   - Adding a scope means updating the OAuth consent screen and the
     Marketplace SDK scope list, and Google may review the change.
   - **Still to confirm from the project itself:** the listing shows what the
     Marketplace SDK declares, which can differ from 1.0's `appsscript.json`.
     Check the manifest of the published script version before relying on the
     table.
3. **A decision about what an upgraded user sees first** (section 2).

### What the public listing says about 1.0 today

Read from the Marketplace page on 2026-11-17:

| | |
| --- | --- |
| Listing | *Sefaria for Google Docs*, app ID `849562338091`, a Docs editor add-on |
| Script project | `1gPEx6tjQrXtEkXkPDplyGINPRlVwLMPj74SHR0_jcnsWe5cfXF_ZnYbU` — path A means pushing into this project |
| Developer | Sefaria (`hello@sefaria.org`), listed as a non-trader |
| Installs | 53,000+; individual and admin install both offered |
| Rating | 4.9 from 11 ratings |
| Listing last updated | 2 July 2026 |
| Privacy, terms, support | `sefaria.org/privacy-policy`, `sefaria.org/terms`, Sefaria's Help Center |

Because admins can install it for a whole domain, some users have it without
having chosen it. A domain admin may need to approve the new scope for those
users, and Sefaria's privacy policy would need to cover saved settings and the
document text that *Link Texts with Sefaria* sends.

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
user who installs a test deployment of this build *beside* 1.0 (its "Account C"). **It has no
in-place upgrade run.** Before path A goes to users, push this code to a copy
of the 1.0 project's state, open a document as a user who has only ever had
1.0, and confirm the bullets above.

---

## 2. Decisions that are Sefaria's to make

| # | Decision | Where it lives now |
| --- | --- | --- |
| 1 | **Name.** The code now says "Sefaria for Google Docs"; confirm it | Section 3 lists every place |
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

## 3. Publishing under Sefaria's name: what is done, what is left

All of it is text and configuration; none of it touches how the add-on works.

### Done (2026-11-20)

| What | Where |
| --- | --- |
| Add-on name `Sefaria for Google Docs` | `appsscript.json` (`addOns.common.name`); must match the listing and the OAuth consent screen exactly |
| The name in the interface | `help-modal.html`, `first-run-setup.html`, `release-notes.html`, `first-run-setup/js.html`, the dialog title in `server/first-run.gs`, one error message in `server/settings-file.gs` |
| Support: Sefaria's Help Center, `https://help.sefaria.org/hc/en-us/sections/20235182393244` | `help-modal.html`, `release-notes.html` |
| Privacy policy `https://www.sefaria.org/privacy-policy`; terms `https://www.sefaria.org/terms` | `help-modal.html`, `preferences.html`, `release-notes.html` |
| "Not made by Sefaria" wording removed | `help-modal.html` → About, `release-notes.html`, the README, the listing copy |
| The Help topic and Release Notes that described a separate add-on installed beside 1.0 are now *Coming from version 1.0* | `help-modal.html`, `release-notes.html` |
| Settings file: the marker stays `torah-library-settings`, so files exported earlier still import; the suggested file name is `sefaria-google-docs-settings.json` | `server/settings-file.gs` |
| README, walkthroughs, live test checklist, listing package | `README.md`, `docs/walkthroughs/`, `docs/live-test-checklist-2.0.0.md`, `docs/marketplace-listing.md` |

### Left

| What | Where |
| --- | --- |
| Manifest logo, still hosted on `the-merkaz.org` | `appsscript.json` (`logoUrl`) — point it at a stable Sefaria URL |
| GitHub links, still to `TheMerkazDev/TorahLibraryAddOnForDocs` | `help-modal.html` (About), `release-notes.html`, `docs/PRIVACY.md` §9 — point them at the repository Sefaria publishes from |
| Sefaria's privacy policy must cover saved settings and the text *Link Texts with Sefaria* sends | Sefaria's site. `docs/PRIVACY.md` is the technical account to check it against; §2 is accurate as written |
| Store icons and banner (a ס with an arrow over "Torah Library") | `docs/store-assets/` — replace with Sefaria's |
| The repository's own name, and the deploy workflow's comment naming TheMerkazDev | GitHub; `.github/workflows/deploy.yml` |

The MIT copyright headers (Shlomi Helfgot; modifications Austin Swafford) and
`LICENSE.md` stay as they are. `docs/TERMS.md`, a draft for an independent
publisher, is superseded by Sefaria's terms. Dated records (the CHANGELOG's
earlier sections, design documents, `reference/ai-lesson/`) keep the name
Torah Library.

### Tests that hold the name

Four test files hold the name or addresses, and were updated with the rename: the snapshots
`test/ui/snapshots/preferences.html.snap` and `first-run-setup.html.snap`
(regenerate with `UPDATE_UI_SNAPSHOTS=1 npm test`, never by hand),
`test/tests/settings-file.test.js` and `test/tests/first-run-setup.test.js`.
`test/ui/help-links.test.js` will catch a Help topic renamed without its
links. Finish with `npm ci && npm test` (0 failing, **0 skipped**) and
`bash pre_clasp_qc.sh apps-script` (exit 0).

---

## 4. Publishing checklist for Sefaria

- [ ] Decisions in section 2 made; section 3 applied; tests and QC green
- [ ] 1.0's `appsscript.json` checked against the scope table in section 1;
      users told in advance that they will be asked to authorize once
- [ ] Deploy target set. `.clasp.json` holds the OtterBrainDev development
      project's script ID and must not be used. Either run `clasp` by hand
      against Sefaria's project, or set the repository variable
      `CLASP_SCRIPT_ID` and the secret `CLASP_TOKEN`
      (`.github/workflows/deploy.yml`, `tools/clasp/README.md`). The workflow
      does nothing until both exist
- [ ] `clasp push` to the project's HEAD, then **Deploy → Test deployments**
- [ ] `docs/live-test-checklist-2.0.0.md` run against that test deployment,
      plus the in-place upgrade run described in section 1
- [ ] In particular, checklist N (v3 and edition identity), O (selection,
      Commentary and Notes), and P (launch compatibility and defaults)
      verified against the reviewed HEAD. The updated
      tutorial scripts are source-supported; new screenshots or recordings
      are not established by the code or local API checks
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

**Where data goes.** Server requests go to `www.sefaria.org`; user input is
URL-encoded. Passage retrieval uses Texts v3, while Ref, Versions, search,
sheets, dictionaries and citation detection retain their own supported
endpoints. The [migration handoff](sefaria-api-migration.md) records exact
routes, edition-gap policy and pending live validation. There is no
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
was possible from the review environment. What is said about 1.0 comes from
its public Marketplace listing, not from its code, and nothing in this file
has been tested against the real 1.0 script project.

**Where to read more**: `docs/architecture.md` (server/client boundary,
storage, the RPC surface), `docs/rpc-surface.json` (every function the pages
can call), `docs/regression-log.md`, `docs/pre-upstream-review.md` (the
2026-08 review and what was fixed).
