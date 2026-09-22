# Using the Torah Library Add-On for Google Docs

A walkthrough of the add-on as it is today (v2.1). The same material is inside
the add-on under **Extensions → Torah Library → Help & Support**, or the
**Help** button at the bottom of the sidebar.

> This is not an official Sefaria project.

## Quick start

1. Put your cursor where the source should go.
2. Open **Extensions → Torah Library → Texts**. The sidebar opens on the right.
3. Type a reference — `Genesis 1:1`, `Berakhot 2a`, `בראשית א:א`. Results
   appear as you type.
4. Click a result. The **Preview** shows exactly what will be inserted.
5. Optional: open **📰 Layout** to choose Hebrew, translation or both, and how
   they are arranged.
6. Click **Add Source** (or press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>).

## The sidebar at a glance

**Along the top**

| Control | What it does |
| --- | --- |
| **Texts** | Search Sefaria's library of texts. |
| **Voices** | Search Sefaria source sheets and insert from them. |
| **Lexicon** | Look up a Hebrew or Aramaic word in Sefaria's dictionaries. |
| **🧪** | Experimental features — only shown when enabled in Preferences. |
| **⌨︎** | On-screen Hebrew keyboard, with a Vowels row. |
| **🔍** | Run the search. Click into the empty search box to see recent searches. |

**Along the bottom**

| Control | What it does |
| --- | --- |
| **Add Source** | Insert the selected source at the cursor. |
| **📰 Layout** | Layout Settings: display, layout and formatting for this session. |
| **📜** | The Session Library — sources you've inserted or pinned. |
| **🏃** | Quick Actions: Insert from Selection, Transform Divine Names, Link Texts with Sefaria. |
| **⚙︎** | Preferences — your saved defaults. |
| **Help** · **Feedback** | Help & Support, and the feedback form. |

## Find a text (Texts tab)

The search runs as you type (after two characters), or press <kbd>Enter</kbd>.
You can search for:

- a reference — `Exodus 20:1-14`, `Berakhot 2a`, `Mishnah Avot 1:1`
- a reference in Hebrew — `שמות כ:א`, `ברכות ב.`
- a traditional citation — `Hil. Shabbat 1:1`, `Rambam, Hil. Teshuvah 3:4`
- a book title, a phrase from the text, or a sefaria.org link

If nothing matches, the sidebar suggests related titles. While the search box
is empty, the tab lists your most recent and pinned sources.

Result tools:

- **A א** — show only works with a translation in a given language.
- **Rel. ▾** — sort by relevance, A–Z, Z–A, category, or most recent.
- **❌** on a result group hides that group; **⤦ Restore Corpus** brings it back.
- <kbd>↑</kbd> / <kbd>↓</kbd> from the search box move through results;
  <kbd>Enter</kbd> picks one.

The selected-source card has **‹ Prev** / **Next ›** to step to the
neighbouring passage and **Open on Sefaria**. Whole books and section headings
can't be inserted — the sidebar says so and keeps **Add Source** disabled until
you pick a specific passage.

## Versions & Preview

**Versions** chooses the translation (**Translation Versions**) and, when
needed, a specific Hebrew edition (**Original Versions**). Your preferred
translation language is set in **Preferences → Fonts → Translation**.

With **Translation** only, or **Hebrew and translation** in the **Stacked**
layout, hold <kbd>Ctrl</kbd> (<kbd>⌘</kbd>) to select several translations.
Each is inserted as its own block, in the order selected. The Preview can't
show several at once. A translation with no text for the passage is greyed out
as *unavailable for this ref* and skipped.

**🔁 Preview** shows what **Add Source** will insert right now.

## Layout Settings (📰 Layout)

Everything here applies to the current sidebar session only.

- **Display** — **A** (translation), **A + א** (Hebrew with translation),
  **א** (Hebrew only).
- **Layout** (with both) — **Stacked**, **Right–Left** (Hebrew on the right),
  **Left–Right** (Hebrew on the left).
- **Insertion Format** — a live sample with switches for **🔗 Title** (link
  the title to Sefaria), **Cantillation**, **Vowels**, **Translit** (with a
  scheme menu), **Lines** (verse/line numbers) and **🔗 Sources** (a citation
  of the translation used).
- **Session** — **↺ Revert to defaults** returns to your Preferences;
  **💾 Save as defaults** makes the current choices your Preferences.

## Inserting

An insertion is a title (linked if **🔗 Title** is on), then the Hebrew,
transliteration and/or translation in your chosen layout, then the translation
citation if **🔗 Sources** is on.

Fonts, sizes and colours come from **Preferences → Fonts**, and default to
**Match the document** — the font and size of the text where you insert.
Titles can be set to Heading 1–6 so they appear in the outline and table of
contents. Sefaria's own bold and italics are kept; change how they look under
**Preferences → Fonts → ✒️ Source Emphasis**.

## Voices (source sheets)

Open the **Voices** tab, search source sheets, pick one, then under **What to
insert** choose **Citation**, **Text** or **Both** and optionally a
transliteration scheme. Defaults live in **Preferences → Insertion → Insertion
Defaults → Voices**.

## Lexicon (dictionary)

Open the **Lexicon** tab and type a Hebrew or Aramaic word. Choose **Full
entry**, **Word + ref** or **Definition**, then **Add Source**. Star entries to
keep them under **⭐ Starred entries**; recent lookups show as chips.

## Session Library (📜)

Every inserted source is added (the most recent twelve, plus any you pin).
Open it with **📜** or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> +
<kbd>L</kbd>. Click a source to reopen it, **📌** to pin it, filter and sort,
**Copy References** for a plain-text list, **Clear Recent** (keeps pinned) or
**Reset Session** (clears everything). The Session Library is kept in your
browser only.

## Quick Actions (🏃)

| Action | What it does |
| --- | --- |
| **Sel → ס** Insert Source from Selection | Select a reference typed in the document and run it. By default the selection is replaced by the source; turn off **Preferences → Insertion → Insert from Selection** to keep it and insert below. |
| **ה → ש** Transform Divine Names | Apply your divine-name replacements to text already in the document. |
| **🔗 → ס** Link Texts with Sefaria | Find citations in the document and link them to Sefaria. |
| **🎲** Surprise Me | Experimental; shown only when enabled in **Preferences → 🧪 Experimental**. |

Menu-only: **Unlink Sources** removes every sefaria.org link from the
document; **Gematriya Count** totals the gematria of the selection (or the
whole document).

## Link Texts with Sefaria

1. Run it from Quick Actions or the menu. A dialog shows progress while the
   document is scanned.
2. Review the table: the words in your document and the Sefaria source each
   will point to. Where a citation could mean more than one source, choose
   from the dropdown (each option shows an excerpt).
3. Each row has a **Link** and an **Insert** checkbox — hyperlink it, insert
   the source's text below the paragraph, both, or neither.
4. Apply. The dialog reports what was linked and what couldn't be.

**Preferences → Linking → After linking** sets how much it asks: **Show a
summary, and ask about ambiguous citations** (recommended), **Show every match
for review**, or **Just link and report a count** (never asks, skips ambiguous
citations; **Insert text after linking** inserts each linked source too).

**Document scanning** controls what is sent to Sefaria: **Candidate passages
only** (default — only passages that look like citations) or **Whole
document**. If the report says citations *could not be placed*, switch to
**Whole document** and run it again.

## Divine names

By default, inserted יהוה becomes יי. The rules are in **Preferences →
Insertion → Divine Name Mappings**: a master switch for replacement on
insertion, and a rule each for יהוה, יה, אלוהים and English *God*, each with a
choice of replacement or **Other**. **Transform Divine Names** applies the same
rules to text already in the document.

## Preferences

Open with **⚙︎** or **Extensions → Torah Library → Preferences**. Preferences
are saved defaults and follow your Google account into every document.

| Tab | Contents |
| --- | --- |
| **Fonts** | Title (plain and linked; paragraph style), Hebrew, Transliteration (scheme), Translation (preferred language) — each with font, size, style, colour, highlight and preview — and ✒️ Source Emphasis. |
| **Insertion** | Default Display & Layout; Insertion Defaults for Texts, Voices and Lexicon; Transliteration Mapping; Divine Name Mappings; Insert from Selection. |
| **Linking** | After linking; Insert text after linking; Document scanning. |
| **Menu Bar** | Reorder, group, hide and divide menu items. |
| **🧪 Experimental** | Optional in-progress features such as Surprise Me. |

Buttons: **Save Defaults**, **Save & Close**, **🔁 Refresh** (reopen the
sidebar from saved defaults) and **Reset To Defaults**.

## The menu

**Extensions → Torah Library** holds, by default: Texts, Voices, Lexicon,
Insert Source from Selection, and a Quick Actions submenu (Quick Actions
Sidebar, Transform Divine Names, Link Texts with Sefaria, Unlink Sources,
Gematriya Count), then Preferences and Help & Support. Customize it in
**Preferences → Menu Bar**; Preferences and Help & Support always stay at the
bottom. Reload the document if a change doesn't appear.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| <kbd>/</kbd> | Jump to the search box |
| <kbd>Enter</kbd> | Search, or pick the highlighted result |
| <kbd>↑</kbd> <kbd>↓</kbd> | Move through results |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> | Add Source |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | Open/close the Session Library |
| <kbd>Esc</kbd> | Close Layout Settings, the Session Library, or the Hebrew keyboard |

## Getting help

- Troubleshooting and a bug-report checklist: **Help & Support → Support**.
- Email: [help@the-merkaz.org](mailto:help@the-merkaz.org)
- [Privacy policy](./PRIVACY.md) · [Changelog](./CHANGELOG.md)

## Current limitations

- Hebrew misspelling tolerance is deferred; valid Hebrew-script references are
  supported, but typo correction is not.
- Linking is deliberately conservative: an ambiguous citation is asked about
  or skipped, never guessed.
