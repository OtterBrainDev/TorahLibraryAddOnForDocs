# Store console package — Google Workspace Marketplace

Everything to enter in the Google Cloud console to publish Torah Library, in
the order the console asks for it, with the text ready to paste. None of it can
live in `appsscript.json`: an editor add-on's manifest carries only a name, a
logo URL and the scopes; Google reads everything else from the console.

Work through it once before submitting, and again whenever a scope, a URL, or
the add-on's behavior changes. **Field limits and required-field markers change
over time — where this file quotes one, confirm it in the console.**

Where the console asks a question this file does not answer, the answer is
probably in [`PRIVACY.md`](PRIVACY.md) — keep the listing, the consent screen
and the policy saying the same thing. A listing that reads as if nothing leaves
the document, next to a consent screen or policy that says otherwise, is the
classic way to get a submission bounced.

---

## 0. Decide these first

Several fields below need a URL or an owner that only the publisher can choose.
Settle them before opening the console, because the same values also appear
inside the add-on.

| Decision | Recommended | Where else it must match |
| --- | --- | --- |
| Publisher shown on the listing | The Merkaz | Terms §intro (legal name), OAuth consent screen |
| Cloud project / Apps Script project that publishes | One owned by a The Merkaz account. The `scriptId` in `.clasp.json` belongs to the OtterBrainDev fork's project and is only the default for running `clasp` by hand | In TheMerkazDev: repository variable `CLASP_SCRIPT_ID` and secret `CLASP_TOKEN` (see `.github/workflows/deploy.yml`) |
| Privacy policy URL | `https://the-merkaz.org/torah-library/privacy` (publish `docs/PRIVACY.md` there). Interim: `https://github.com/TheMerkazDev/TorahLibraryAddOnForDocs/blob/master/docs/PRIVACY.md`, which is what the add-on links to today | `apps-script/preferences.html` (Privacy note), `apps-script/help-modal.html` (About → Privacy policy) — update both if you move it |
| Terms of service URL | `https://the-merkaz.org/torah-library/terms` (publish `docs/TERMS.md` there after review) | — |
| Support URL | `https://the-merkaz.org/torah-library` with a contact route, or `mailto:help@the-merkaz.org` if the form accepts it | Help → Support, Release Notes |
| Source-code link | `https://github.com/TheMerkazDev/TorahLibraryAddOnForDocs` (already used in the add-on). Issues are turned off on that repository, so the add-on sends bug reports to `help@the-merkaz.org`; if you turn Issues on, the Release Notes and `PRIVACY.md` §9 can link to them | `help-modal.html` GitHub pills, `release-notes.html`, `PRIVACY.md` §9 |

A GitHub blob URL works as an interim privacy/terms URL — the TheMerkazDev
repository is public — but it is tied to a repository owner and branch name. A
page on the publisher's own domain is stable.

---

## 1. OAuth consent screen

*Google Cloud console → APIs & Services → OAuth consent screen* (in newer
consoles: *Google Auth Platform → Branding / Audience / Data access*).

| Field | Value |
| --- | --- |
| User type | External |
| App name | `Torah Library` — must match `addOns.common.name` in `appsscript.json` |
| User support email | `help@the-merkaz.org` |
| App logo | The 128 × 128 icon from §3 |
| Application home page | The project page from §0 |
| Application privacy policy link | The privacy URL from §0 |
| Application terms of service link | The terms URL from §0 |
| Authorized domains | `the-merkaz.org` (and `github.com` only if any URL above stays on GitHub) |
| Developer contact email | A monitored The Merkaz address |

### Scopes (Data access)

Add exactly these four — they must match `oauthScopes` in
`apps-script/appsscript.json`, character for character:

| Scope | Justification to paste |
| --- | --- |
| `https://www.googleapis.com/auth/documents.currentonly` | Reads the user's selection and inserts Sefaria texts into the document the add-on is open in. This is the restricted variant: it grants no access to Google Drive or to any other document. |
| `https://www.googleapis.com/auth/script.container.ui` | Displays the add-on's menu, sidebar, and dialogs inside Google Docs. |
| `https://www.googleapis.com/auth/script.external_request` | Fetches texts, search results, and citation links from Sefaria's public API at www.sefaria.org. The add-on's server code contacts no other host. |
| `https://www.googleapis.com/auth/script.storage` | Stores the user's own display and insertion preferences. No credentials and no document content are stored. |

The add-on requests no access to the user's email address, profile, Drive,
contacts, or any other Google service, and stores no credential of any kind.

### If Google asks for verification

Google decides whether these scopes need verification. If it asks, the question
that matters is *what leaves the user's document*. The answer, consistent with
`PRIVACY.md` §2:

> Torah Library sends Sefaria only what the user asks for: search terms, the
> references they select, and words they look up. The one feature that sends
> document text is **Link Texts with Sefaria**, which the user runs explicitly.
> By default the add-on scans the document locally and uploads only passages
> that look like they contain a citation; the user can switch to whole-document
> scanning or never run the command. A one-time confirmation explains this
> before the first upload. Nothing is sent to the add-on's publisher — there is
> no server, account, or analytics.

A short screen recording helps: open the sidebar, search, insert a source, then
run Link Texts with Sefaria and show the confirmation and review dialog.

---

## 2. Marketplace SDK → App Configuration

*Google Cloud console → APIs & Services → Google Workspace Marketplace SDK →
App Configuration.* Enable the Marketplace SDK for the project first.

| Field | Value |
| --- | --- |
| App visibility | Public |
| Installation settings | Individual + Admin install |
| App integration | **Editor add-on** → **Docs add-on**. (Not "Google Workspace add-on" — this add-on is menu- and HtmlService-based; its `addOns.common` manifest block only supplies the name and logo.) |
| Script ID | The publishing project's script ID (§0) |
| Script version | The version number from the release step in §6 |
| OAuth scopes | The four from §1 |
| Developer name | The Merkaz |
| Developer website URL | `https://the-merkaz.org` |
| Developer email | `help@the-merkaz.org` |

---

## 3. Marketplace SDK → Store Listing

### App details

| Field | Value |
| --- | --- |
| Language | English |
| Application name | Torah Library |
| Category | Education (alternative: Productivity) |
| Pricing | Free |

**Short description** (limit is about 200 characters — this is 174):

```
Find texts in Sefaria's library of Jewish sources and insert them into Google Docs — Hebrew, translation, or both — or turn the citations already in your document into links.
```

**Detailed description** (plain text; paste as is):

```
Torah Library brings Sefaria's free library of Jewish texts into Google Docs. Search by reference, title, or phrase, preview exactly what you'll get, and insert it formatted the way you want — without leaving your document.

WHAT YOU CAN DO
• Find a text by reference ("Berakhot 2a", "בראשית א:א"), title, phrase, or a Sefaria link, and preview it before inserting.
• Insert Hebrew, translation, or both — side by side or stacked — and choose among the translations Sefaria has for the passage, or insert several at once.
• Control how Hebrew appears: show or hide niqqud and ta'amim, and choose how divine names are written in Hebrew and English.
• Keep the source's own emphasis — for example, the Steinsaltz Talmud's bolding of the Talmud's words — and set fonts, sizes, colours, and highlights for every part of an inserted source.
• Add a citation and a link back to Sefaria with each source.
• Search Sefaria source sheets in Voices.
• Link Texts with Sefaria: turn citations already written in your document into Sefaria links, with a review step when a citation could mean more than one source.
• Arrange the add-on's menu to put the actions you use most at the top.

YOUR DOCUMENT AND YOUR PRIVACY
Torah Library can open only the document you are using it in — never your Drive or your other documents. It has no server, no account, and no analytics. Sefaria receives what you search for and the references you choose. "Link Texts with Sefaria" sends text from your document to Sefaria so it can find citations; by default only passages that look like they contain a citation are sent, and you are asked before the first time. The full privacy policy explains exactly what is sent and when.

ABOUT
Torah Library is an independent, open-source add-on built on Sefaria's public library and API. It is not made by Sefaria. Texts and translations carry their own licenses, shown on sefaria.org.
```

### Graphic assets

| Asset | Size | Status |
| --- | --- | --- |
| Application icon | 128 × 128 PNG | **Needed.** Export from the source artwork of `sefarrow_32.png` (the manifest `logoUrl`), not by upscaling the 32 px file. It should not resemble Sefaria's own logo. |
| Application icon | 32 × 32 PNG | The existing `sefarrow_32.png`. |
| Application card banner | 220 × 140 PNG | **Needed.** Icon plus "Torah Library" on a plain background. |
| Screenshots | 1280 × 800 PNG (or the console's current size), 1–5 | **Needed** — shot list below. |
| Promotional video | YouTube URL | Optional. |

The manifest `logoUrl` must stay a public, stable HTTPS URL: Google fetches it to
draw the icon in the Docs **Extensions** menu (the user's browser does not load
it from the add-on). It currently points at `the-merkaz.org`, which is fine as
long as that file stays put.

**Screenshot shot list** — take them from a test deployment (§6) in a clean
document at 1280 × 800, sidebar open, no personal content visible:

1. Texts: a search for `Genesis 1:1` with the Hebrew + English preview in the
   sidebar and the inserted, side-by-side result in the document.
2. Translation choice: the translation list open, several translations
   selected, and the inserted blocks.
3. Hebrew display: the same passage with niqqud on and off, or a divine-name
   setting applied.
4. Link Texts with Sefaria: the review dialog, with an ambiguous citation's
   dropdown open.
5. Preferences: the Fonts tab or the Menu Bar tab.

Caption each one in a few words (e.g. *"Preview, then insert Hebrew and English
side by side"*).

### Support links

| Field | Value |
| --- | --- |
| Terms of service URL | From §0 |
| Privacy policy URL | From §0 |
| Support URL | From §0 |

---

## 4. Before you submit

### Repository

- [ ] `npm ci && npm test` — 161 passing, 0 failing, **0 skipped**
- [ ] `bash pre_clasp_qc.sh apps-script` — exit 0
- [ ] `grep -rn "getActiveUser\|getEffectiveUser\|getEmail" apps-script/` — empty
- [ ] Every `UrlFetchApp` call still targets `sefaria.org`:

      ```bash
      grep -rn "UrlFetchApp.fetch" apps-script/          # 10 call sites
      grep -rn "url = 'https\|url = \`https" apps-script/  # every base URL
      ```

      Four pass a literal URL; the other six pass a variable assigned a line or
      two above, so a single grep for the host **under-reports**. Check both.
- [ ] `apps-script/appsscript.json` lists exactly the four scopes in §1
- [ ] Every external host the add-on's pages load is listed in `PRIVACY.md`
      §2.2 — `grep -rhoE "(src|href)=[\"']https?://[^\"' ]+" apps-script --include=*.html`
      plus any `@import`
- [ ] `docs/VERSION.json` `status: "released"` with a date, and the CHANGELOG's
      `Unreleased` sections consolidated under one `v2.1.0` heading
      (`test/ui/version-manifest.test.js` enforces both)

### Live

- [ ] `docs/live-test-checklist-2.1.0.md` passed against a test deployment,
      including a fresh install (the menu must appear without reloading) and an
      upgrade from the previous version
- [ ] Privacy policy and terms reachable at the console URLs, and current
- [ ] The in-app privacy link (Preferences, Help → About) opens the same policy

### Still open in the code — resolve or accept before submitting

These came out of the 2026-09 pre-publication review and are **not** fixed in
this package. The first two are the ones most likely to draw a reviewer's (or
Sefaria's) attention.

- [ ] **Reads as an official Sefaria product.** The sidebar title is `'Sefaria'`
      (`apps-script/server/menu.gs:63`); the sidebar footer shows Sefaria's logo
      (`apps-script/sidebar.html:523`). Change the title to `Torah Library`, and
      use the logo only with Sefaria's permission.
- [ ] **Feedback goes to Sefaria.** `apps-script/feedback-modal.html:70` embeds
      Sefaria's own Formstack form, so Sefaria receives this add-on's bug
      reports. Replace it with the publisher's contact route unless Sefaria
      agrees to it.
- [ ] **Attribution off by default.** New installs insert texts with no
      citation or license line (`insert_citation_default` and
      `include_translation_source_info` are `false` in
      `server/preferences.gs`). Many Sefaria translations are CC-BY or
      CC-BY-NC.
- [ ] **Deploy target.** In TheMerkazDev, set the `CLASP_SCRIPT_ID` variable to
      the publishing project and add a `CLASP_TOKEN` secret with access to it
      (§0). Until then the deploy workflow is skipped there.

---

## 5. After approval

- The listing goes live after Google's review; the add-on appears in
  **Extensions → Add-ons → Get add-ons** in Docs.
- Changes to the store listing (text, images, URLs) go through review again.
  Changing the **script version** in App Configuration (§6) normally does not,
  unless the release also changes the OAuth scopes.
- Watch `help@the-merkaz.org` and the listing's reviews; the add-on has no
  telemetry, so these are the only signals that something broke.

---

## 6. Releasing a new version — what users actually get

`clasp push`, and the deploy workflow on every push to `master`, replace the
script project's **HEAD**. HEAD is only what the project's editors run through
Apps Script → **Deploy → Test deployments**. **Marketplace users never run
HEAD.** They run the numbered script version that App Configuration (§2)
points to.

So a release is:

1. Push to HEAD (the deploy workflow does this on `master`, after tests and QC).
2. Install HEAD as a test deployment in a test document and run the live test
   checklist, including a fresh install and an upgrade.
3. Freeze HEAD as a version, described with the add-on version so the two can
   be matched later:

   ```bash
   clasp version "v2.1.0"      # prints the new version number, e.g. 14
   ```

   (Or *Project history → New version* in the Apps Script editor.)
4. Marketplace SDK → App Configuration → set **Script version** to that
   number → **Save**.

What users experience:

- **No action on their part.** Installed users get the new version the next
  time they open a document (a document already open keeps the old code until
  it is reloaded). There is no update prompt and no way to stay on the old
  version.
- **Preferences carry over.** On the first open, `onOpen` runs any pending
  preference migrations (`apps-script/migrations.gs`) before building the menu.
- **New scopes mean re-consent.** If a release adds an OAuth scope, users are
  asked to authorize again and the add-on does not run until they do — which
  is why hard rule #6 in `CLAUDE.md` exists.
- **Rollback** is step 4 pointed at the previous version number; it takes
  effect the same way.

Record the version number next to the release in `docs/CHANGELOG.md`.
