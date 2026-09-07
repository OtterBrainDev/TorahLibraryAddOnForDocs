# Marketplace listing and OAuth verification checklist

The repository cannot hold these values — they live in the Google Cloud console
attached to the Apps Script project, and Google reads them from there, not from
`appsscript.json`. An editor add-on's manifest has **no** privacy-policy or
terms field; `addOns.common` carries only the name, logo and locale.

So this file exists to make the console work checkable instead of remembered.
Work through it once before submitting, and again whenever a scope changes.

---

## 1. OAuth consent screen

*Google Cloud console → APIs & Services → OAuth consent screen*

| Field | Value |
| --- | --- |
| App name | Torah Library |
| User support email | help@the-merkaz.org |
| App logo | the same asset as `addOns.common.logoUrl` |
| Application home page | the project's public page |
| **Application privacy policy link** | the published URL of `docs/PRIVACY.md` — see §3 |
| Application terms of service link | optional, but fill it if the listing has one |
| Authorized domains | every domain used above, plus `sefaria.org` |

### Scope justifications

Verification asks *why* for each scope. These are the answers, and they match
what the code actually does — a reviewer who greps the source will find nothing
broader:

| Scope | Justification |
| --- | --- |
| `documents.currentonly` | Read the user's selection and insert Sefaria sources into the document they have the add-on open in. This is the restricted variant: it grants **no** access to Drive or to any other document. Say that explicitly — it is the strongest thing on the consent screen. |
| `script.container.ui` | Draw the add-on menu, sidebar and dialogs. |
| `script.external_request` | Fetch texts from `sefaria.org`. All ten `UrlFetchApp` call sites target that host — see the verification note below. |
| `script.storage` | Store the user's own display and insertion preferences. No credentials, no document content. |

The add-on requests **no** access to email address, Drive, profile or contacts,
and holds no credential of any kind. `grep -rn "getActiveUser\|getEffectiveUser\|getEmail" apps-script/`
returns nothing — worth running before you submit, so the claim stays true.

### The question verification will ask

Expect to be asked what leaves the user's document. The honest answer, which
§2.1 of the policy also gives:

> **Link Texts with Sefaria** sends document text to `sefaria.org` so their
> reference linker can find citations. By default the add-on scans locally first
> and uploads only the passages that look like they contain a citation; the user
> can switch to whole-document scanning, or not run the command at all. Nothing
> is uploaded until the user runs it, and a one-time confirmation is shown
> before the first upload.

---

## 2. Marketplace SDK listing

*Google Cloud console → APIs & Services → Google Workspace Marketplace SDK →
App configuration / Store listing*

- **Privacy policy URL** — same URL as §1. Required.
- **Terms of service URL** — required by the listing form.
- **Support URL** — where a user reports a problem.
- **Detailed description** — mention the linker's upload plainly. A listing that
  reads as if nothing leaves the document, followed by a consent screen that
  says otherwise, is what gets a submission bounced.

---

## 3. Publishing the privacy policy

`docs/PRIVACY.md` is the source of truth. Google needs it at a stable, public
URL that is **not** a GitHub blob link if you can avoid it — a blob URL is tied
to this fork's branch name and repository owner, and both can change.

Preferred: publish it under the project's own domain and point the console
there.

Interim: the GitHub URL works and is what the in-app links currently use.

> **If this repository is ever transferred or upstreamed**, the two in-app links
> move with it. They are hardcoded in:
>
> - `apps-script/preferences.html` — Privacy & Document Scanning section
> - `apps-script/help-modal.html` — About tab
>
> Update both, and the console URLs, in the same change. There are only two, so
> they are deliberately not behind an indirection — but they are easy to miss.

---

## 4. Before you submit

- [ ] `npm ci && npm test` — 119 passing, 0 failing, **0 skipped**
- [ ] `bash pre_clasp_qc.sh apps-script` — exit 0
- [ ] `grep -rn "getActiveUser\|getEffectiveUser\|getEmail" apps-script/` — empty
- [ ] Every `UrlFetchApp` call still targets `sefaria.org`:

      ```bash
      grep -rn "UrlFetchApp.fetch" apps-script/          # 10 call sites
      grep -rn "url = 'https\|url = \`https" apps-script/  # every base URL
      ```

      Four pass a literal URL; the other six pass a variable assigned a line or
      two above, so a single grep for the host **under-reports**. Check both
      commands — the second is where the other six live.
- [ ] `apps-script/appsscript.json` lists exactly the four scopes in §1
- [ ] Privacy policy reachable at the URL in the console, and current
- [ ] The in-app privacy links (§3) resolve

## 5. Deployment

Deployment itself is fork-local and already automated —
`.github/workflows/deploy.yml` runs the test suite and QC in a `verify` job,
then pushes with `clasp`. It is gated on `github.repository`, so a fork or an
upstream merge skips it entirely rather than pushing into this fork's script
project. See the comment at the top of that file.
