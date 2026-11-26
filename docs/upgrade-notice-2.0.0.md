# Sefaria for Google Docs 2.0 — upgrade notice

Drafted 2026-11-19 against the 2.0.0 release candidate. **Draft, not sent or
published.** It applies only if Sefaria publishes 2.0 through the Apps Script
project behind its existing listing (path A in
[`for-sefaria-review.md`](for-sefaria-review.md) §1). Sefaria's approval and
the release date are not established.

Source copy reconciled on 2026-11-25 for the candidate's insertion options,
edition selection, Commentary and Notes, selection actions, legacy setup,
Help and profile-aware Import/Export. In-place upgrade behavior
and the new Google Docs checks still need live verification before this
notice is sent.

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

**What's new.** Preview a source before inserting it, remember your preferred
settings, choose a bilingual layout or transliteration, and find dictionary
entries and source sheets. The most-used insertion choices stay together,
with additional settings in folding groups. You can also insert several
translations at once and choose separately how supported inline commentary
and marked footnotes appear.

**When you first open the sidebar**

- A short setup appears. Choose **I've used Sefaria for Google Docs 1.0** and
  Continue for familiar bilingual Hebrew-right layout, Simple, and the
  **Add Sources with Sefaria** menu. Voices and Lexicon are initially off in
  this preset; enable them later in Preferences → Sidebar.
- The 1.0 preset keeps Sefaria's divine-name spelling. Other setup paths start
  with the add-on's defaults, including automatic יהוה → יי unless changed.
- Check the citation setting. By default, new sources carry a credit line
  naming the edition and its license.
- Selecting a search result now shows a preview. Click **Add Source** to
  insert it.
- Leave **Commentary** on **Default** to preserve the edition's explanation
  and markings. **Notes** starts on **Omit**, preserving the previous
  inserted output; choose Inline or Separate in **Insertion Options → Text and
  notes** (or Layout in Preferences) to include marked footnotes. Separate
  creates an ordinary Notes text section.
- Display, Arrangement, Line by line and Transliteration stay at the top of
  Insertion Options when applicable. Other choices are in three folding
  groups: Text and notes, References and numbering, and Fonts and appearance.
  These session choices are saved for later only with **Save as defaults**.
- Your chosen translation and Hebrew edition stay selected when you change
  insertion options. An edition's missing verses stay missing instead of
  being filled from a different edition. Choose another in Versions if needed.
  In Translation only or the bilingual Stacked arrangement, Ctrl-click
  (Cmd-click on Mac) adds or removes individual translations and Shift-click
  selects a range.
- **Insert Source from Selection** opens review for one or several selected
  citations, even if Link Texts normally runs quietly. Choose Insert or Link;
  own-line citations may be replaced according to Preferences → Insertion.
  Highlight text to limit Link Texts and Gematriya Count, or clear the
  selection for the document body.
- **⇅ Import/Export** beside Interface in Preferences shares or restores
  settings in either mode. Everything lets you select a named profile.
  **Help → Re-run Setup Wizard** offers keeping or resetting active preferences.

All of these can be changed later in **Preferences**.

Release date: [to be confirmed].

- Help and support: <https://help.sefaria.org/hc/en-us/sections/20235182393244>
- Privacy policy: <https://www.sefaria.org/privacy-policy>
- Terms of use: <https://www.sefaria.org/terms>

---

## Confirm before sending

- **Setup and defaults are Sefaria's decisions** (`for-sefaria-review.md` §2,
  decisions 2–4). The candidate offers upgraded users setup, with a one-step
  1.0 preset that disables automatic divine-name substitution and retains
  attribution. Other paths start from the ordinary defaults. If Sefaria
  changes these decisions, revise the matching bullet.
- **The 1.0 permission baseline comes from the public listing**, not from
  1.0's manifest. The listing shows 1.0 requesting email and profile, which
  2.0 does not. Once the published 1.0 manifest confirms that, this sentence
  can be added: "It also stops requesting your email address and profile."
- **No in-place upgrade has been run live.** What an upgraded user sees is
  read from the code; the live test checklist covers only an install beside
  1.0.
- **The candidate's logo and GitHub links are still The Merkaz's**
  (`for-sefaria-review.md` §3); its name, support, privacy and terms links are
  Sefaria's. Sefaria's privacy policy needs to cover saved settings and the
  text *Link Texts with Sefaria* sends.
- **The release date** is still a placeholder.
