# Privacy Policy — Torah Library Add-On for Google Docs

**Last updated: 2026-08-28**

This add-on inserts texts from [Sefaria](https://www.sefaria.org) into your
Google Doc. This policy describes exactly what data it touches, what leaves
your computer, and what is stored.

Short version: the add-on has no server of its own, no account, and no
analytics. It talks to exactly two parties — Google (to read and write the
document you have open) and Sefaria (to fetch the texts you ask for). It
stores nothing about you anywhere except your own preference settings, which
live in Google's own per-user storage for this add-on.

---

## 1. What the add-on can access

The add-on requests four OAuth scopes. Each is the narrowest scope that does
its job:

| Scope | What it allows | Why it is needed |
| --- | --- | --- |
| `.../auth/documents.currentonly` | Read and edit **only the single document the add-on is currently open in** | To read your selection and insert sources. This scope does **not** grant access to your Google Drive, to your other documents, or to any document you are not actively using the add-on in. |
| `.../auth/script.container.ui` | Show the menu, sidebar, and dialogs | The add-on's entire interface. |
| `.../auth/script.external_request` | Make outbound network requests | To fetch texts from `sefaria.org`. The add-on contacts no other host. |
| `.../auth/script.storage` | Store per-user settings | To remember your font, layout, and insertion preferences. |

The add-on does **not** request access to your email address, your Google
profile, your Drive, your contacts, or any other Google service.

## 2. What is sent to Sefaria

Sefaria is a third party. When you use the add-on, the following — and only
the following — is sent to `https://www.sefaria.org`:

| When | What is sent |
| --- | --- |
| You search for a text | Your search terms. |
| You select or insert a source | The reference you selected (e.g. `Genesis 1:1`). |
| You look up a word in the Lexicon | The word you looked up. |
| You search Voices (source sheets) | Your search terms. |
| You run **Link Texts with Sefaria** | Text from your document — see §2.1 below. |

Your search terms and references are of course things you typed on purpose.
The linker is the one feature that sends text you did not explicitly hand
over, so it gets its own section.

### 2.1 The "Link Texts with Sefaria" feature

This feature finds citations already written in your document and turns them
into Sefaria hyperlinks. To do that, Sefaria's reference-linker service has to
see the text.

You control how much text is sent, in **Preferences → Privacy & Document
Scanning**:

- **Candidate passages only (the default).** Before anything is sent, the
  add-on scans your document *on your own machine* and identifies only the
  passages that could contain a citation — a known Sefaria book title, a
  chapter-and-verse number, a Talmudic page reference, or a Hebrew
  abbreviation. Only those passages, plus a small amount of surrounding
  context needed to resolve them, are uploaded. Paragraphs of your own
  writing that contain no citation are never transmitted.
- **Whole document.** The entire body text of the document is uploaded. This
  can catch unusual citation forms the local scan misses. This was the
  add-on's original behavior.

In either mode, nothing is uploaded until you explicitly run the command.
Sefaria receives the text; it does not receive your name, your email address,
your document's title, or its Google Drive location, because the add-on never
has access to those in the first place.

Sefaria's handling of what it receives is governed by
[Sefaria's own privacy policy](https://www.sefaria.org/privacy-policy).

## 3. What is stored, and where

**Your preferences** — fonts, sizes, layout, divine-name replacement
settings, default insertion options — are stored using Google's
`PropertiesService` user storage. This is per-user, per-add-on storage
managed by Google. It is not readable by other add-ons, by other users, or by
the add-on's authors.

**Sidebar session state** — the temporary choices you make in a single
sidebar session — is stored in Google's `CacheService` and expires
automatically within 6 hours.

**Nothing else is stored.** Specifically:

- There is **no server** operated by this add-on's authors. There is nowhere
  for your data to be sent to or retained by us, because there is no "us"
  in the data path at all.
- There are **no analytics**, no telemetry, no usage tracking, no crash
  reporting.
- There are **no cookies** and no advertising identifiers.
- **No credentials or API keys** are stored. The add-on requires no login of
  any kind.
- Your **document content is never stored** anywhere by the add-on — not on
  disk, not in a cache, not in a log.

## 4. Logging

The add-on writes diagnostic messages to Google Apps Script's own execution
log, visible only to the script's owner. These log entries are limited to
error messages, function names, and reference strings you entered (e.g. a
reference that failed to resolve). Document text, preference values, and
credentials are never logged.

## 5. Data sharing

The add-on shares no data with anyone. It has no advertising partners, no
data brokers, no third-party SDKs, and no subprocessors. The only outbound
network traffic is to `sefaria.org`, as described in §2.

## 6. Data retention and deletion

The add-on retains only your preference settings. To delete them:

- Use **Preferences → Reset Preferences** to restore defaults, or
- Uninstall the add-on. Google removes the add-on's `PropertiesService`
  storage when you uninstall it.

Cached sidebar session state expires on its own within 6 hours and requires
no action.

## 7. Children

The add-on is a study tool with no account system and collects no personal
information, so it does not knowingly collect data from anyone, including
children under 13.

## 8. Changes to this policy

Material changes will be recorded in `docs/CHANGELOG.md` and reflected in the
"Last updated" date above. The current version of this policy always lives at
the URL linked from the add-on's Preferences screen and its Marketplace
listing.

## 9. Contact

Questions about this policy, or about the add-on's data handling, can be
raised as an issue on the project's GitHub repository:
<https://github.com/OtterBrainDev/TorahLibraryAddOnForDocs/issues>

---

### A note on verifying these claims

Every statement above is checkable against the source, which is public:

- The OAuth scopes are declared in `apps-script/appsscript.json`.
- Every outbound request is a `UrlFetchApp` call; `grep -rn "UrlFetchApp"
  apps-script/` shows all of them, and every one targets `sefaria.org`.
- The linker pre-filter is `apps-script/server/linker-prefilter.gs`, with
  tests in `test/tests/linker-prefilter.test.js` that assert prose without a
  citation is not uploaded.
- The absence of user-identity access is checkable:
  `grep -rn "getActiveUser\|getEffectiveUser\|getEmail" apps-script/`
  returns nothing.
