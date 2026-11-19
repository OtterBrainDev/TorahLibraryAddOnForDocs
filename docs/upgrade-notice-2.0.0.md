# Sefaria for Google Docs 2.0 — upgrade notice

Drafted 2026-11-19 against the 2.0.0 release candidate. **Draft, not sent or
published.** It applies only if Sefaria publishes 2.0 through the Apps Script
project behind its existing listing (path A in
[`for-sefaria-review.md`](for-sefaria-review.md) §1). Sefaria's approval and
the release date are not established.

---

**Subject: Sefaria for Google Docs 2.0: you'll be asked to authorize one new permission**

An update to Sefaria for Google Docs will reach current users through the
existing add-on, with nothing new to install. **The first time you use it
after the update, Google will ask you to authorize it again.**

**Why the request.** Version 2.0 can remember your settings, such as fonts,
languages and layout. To do that it needs one new permission: storing those
settings in Google's per-user storage for this add-on. Only settings are
stored there, not document text.

**What does not change.** Sefaria for Google Docs can still reach only the
Google Doc you are using it in. It gains no access to your Drive or other
documents, and version 2.0 does not request your email address or Google
profile. The update itself does not alter text or sources already in your
documents.

**If you decline.** You can keep editing your document, but Sefaria for Google
Docs will not run until you authorize it, and the earlier version will not be
available instead. On a school or workplace account, your administrator may
need to approve the permission first.

**What's new.** Saved preferences, more layout and formatting choices,
dictionary and source-sheet search, and a preview before a source is inserted.

**When you first open the sidebar**

- A short setup appears. Choose **I've used Sefaria for Google Docs** to start
  with the familiar layout: Hebrew and translation, Hebrew on the right.
- Check the divine-name setting. By default, newly inserted sources replace
  יהוה with יי. Turn this off to keep Sefaria's spelling.
- Check the citation setting. By default, new sources carry a credit line
  naming the edition and its license.
- Selecting a search result now shows a preview. Click **Add Source** to
  insert it.
- **Insert Source from Selection** replaces the highlighted citation by
  default. To keep the citation and insert below it, change this in
  Preferences → Insertion.

All of these can be changed later in **Preferences**.

Release date: [to be confirmed].

- Help and support: <https://help.sefaria.org/hc/en-us/sections/20235182393244>
- Privacy policy: <https://www.sefaria.org/privacy-policy>
- Terms of use: <https://www.sefaria.org/terms>

---

## Confirm before sending

- **Setup and defaults are Sefaria's decisions** (`for-sefaria-review.md` §2,
  decisions 2–4). The candidate shows setup to an upgraded 1.0 user, replaces
  divine names on insert and adds the credit line. If Sefaria changes any of
  these, change or drop the matching bullet.
- **The 1.0 permission baseline comes from the public listing**, not from
  1.0's manifest. The listing shows 1.0 requesting email and profile, which
  2.0 does not. Once the published 1.0 manifest confirms that, this sentence
  can be added: "It also stops requesting your email address and profile."
- **No in-place upgrade has been run live.** What an upgraded user sees is
  read from the code; the live test checklist covers only an install beside
  1.0.
- **The candidate still carries the Torah Library name**, logo, support
  address and policy links (`for-sefaria-review.md` §3). This notice assumes
  they are changed to Sefaria's before release, and that Sefaria's privacy
  policy covers saved settings and the text *Link Texts with Sefaria* sends.
- **The release date** is still a placeholder.
