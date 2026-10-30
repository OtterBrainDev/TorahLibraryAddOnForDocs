# Using the Torah Library Add-On for Google Docs

A walkthrough of the add-on as it is today (v2.1, plus the unreleased changes
in the [changelog](./CHANGELOG.md)). The same material is inside
the add-on under **Extensions → Torah Library → Help & Support**, or the
**Help** button at the bottom of the sidebar.

> This is not an official Sefaria project.

## Quick start

1. Put your cursor where the source should go.
2. Open **Extensions → Torah Library → Texts**. The sidebar opens on the right.
3. Type a reference — `Genesis 1:1`, `Berakhot 2a`, `בראשית א:א`. Results
   appear as you type.
4. Click a result. The **Preview** shows exactly what will be inserted.
5. Optional: open **📰 Insertion Options** to choose Hebrew, translation or both, and how
   they are arranged.
6. Click **Add Source** (or press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>).

The first time a new user opens the add-on, a three-step setup asks what it is
for, how sources should look (with a preview) and how much of the add-on to
show. Every answer starts at the current setting, so clicking through changes
nothing. **Help & Support → Quick start → Run setup again** reopens it.

## The sidebar at a glance

**The search box**

| Control | What it does |
| --- | --- |
| **⌨︎** | On-screen Hebrew keyboard, with a Vowels row. |
| **🔍** | Run the search. Click into the empty search box to see recent searches. |

**Under the search box**, a segmented control chooses the kind of result.
Switching runs the same search again in the other one, so there is nothing to
retype.

| Control | What it does |
| --- | --- |
| **Texts** | Search Sefaria's library of texts. |
| **Voices** | Search Sefaria source sheets and insert from them. |
| **Lexicon** | Look up a Hebrew or Aramaic word in Sefaria's dictionaries. |
| **🧪** | Experimental features — only shown when enabled in Preferences. |

**Along the bottom**

| Control | What it does |
| --- | --- |
| **Add Source** | Insert the selected source at the cursor. |
| **📰 Insertion Options** | The full-width button under Add Source: display, arrangement and formatting for this session. |
| **📜** | The Session Library — sources you've inserted or pinned. |
| **🏃** | Quick Actions: Insert from Selection, Transform Divine Names, Link Texts with Sefaria. |
| **⚙︎** | Preferences — your saved defaults. Shows *Opening Preferences…* until the dialog appears; repeat clicks do nothing meanwhile. |
| **Help** · **Feedback** | Help & Support, and the feedback form. |

## Simple or Everything

Two interfaces; switch at the top of Preferences, under **Interface** (it
takes effect at once, without Save). Simple hides, and never removes:

- **Sidebar:** the result sort, **⤦ Restore Corpus**, and the Texts / Voices /
  Lexicon control while in Texts. Add Source, Insertion Options and the footer
  buttons stay in both modes.
- **Menu:** a shorter menu — Texts, Insert Source from Selection, Transform
  Divine Names, Link Texts with Sefaria, then Preferences and Help & Support.
  Switching back to Everything restores the menu you had.
- **Preferences:** the Search, Linking and 🧪 Experimental tabs and the
  advanced Fonts sections, until **Show advanced settings** is ticked.

Existing users keep Everything and never see the setup.

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
neighbouring passage and **Open on Sefaria**. Book and section headings with no
text of their own (*Mishneh Torah*) can't be inserted — the sidebar says so and
keeps **Add Source** disabled until you pick a specific passage. A book Sefaria
opens at its first chapter (*Genesis* on its own) previews and inserts that one
chapter, titled *Genesis 1*.

## Versions & Preview

**Versions** chooses the translation (**Translation Versions**) and, when
needed, a specific Hebrew edition (**Original Versions**). Your preferred
translation language is set in **Preferences → Fonts → Translation**.

With **Translation** only, or **Hebrew and translation** in the **Stacked**
layout, each click on a translation adds or removes it, so several can be
selected. Each is inserted as its own block, in the order selected. The Preview
can't show several at once; it lists them in that order. A translation with no text for the passage is greyed out
as *unavailable for this ref* and skipped.

**🔁 Preview** shows what **Add Source** will insert right now.

## Insertion Options (📰)

Everything here applies to the current sidebar session only. The same controls
set your saved defaults in **Preferences → Insertion**, and one linking pass in
Link Texts' **📰 Customize this insertion**. **↺ Revert** (back to your
Preferences) and **💾 Save as defaults** (make these your Preferences) are at
the top of the panel, greyed out until something differs. The panel scrolls;
<kbd>Esc</kbd> closes it.

**Layout**

- **Display** — a segmented control: **A** (translation), **A + א** (Hebrew
  with translation), **א** (Hebrew only).
- **Arrangement** (with both) — **Stacked**, **Right–Left** (Hebrew on the
  right), **Left–Right** (Hebrew on the left).
- Then a switch each for **Citation** (the editions and their licenses under
  the text), **Line by line** (Right–Left and Left–Right only: one table row
  per verse, beside its translation) and **Line numbers**.

**Insertion Format** — two sections, **Source** (the Hebrew) and
**Translation**. Each folds to one line saying what is set (*Vowels,
Cantillation, Punctuation · Translit*); click it for the live sample and the
settings, one per row. In the sidebar and Link Texts they start folded; in
Preferences, open. With Display on the translation alone the Source section is
hidden, and with the Hebrew alone the Translation section.

| Row | Section | What it does |
| --- | --- | --- |
| **Link title to Sefaria** | both | Link that title to the passage on sefaria.org. The source title and the translation title are set separately. |
| **Title font** | both | That title's font and size, linked or not. |
| **Text font** | both | The Hebrew's, or the translation's, font and size. Opens a small panel (**Font**, **Size**; a blank size matches the text where you insert); **Colour, style and more…** there opens Preferences. |
| **Vowels** | Source | **Off** / **Tanakh** (Tanakh only, as the original add-on did) / **On**. |
| **Cantillation** | Source | **Off** / **Tanakh** / **Torah** (the Five Books only). |
| **Punctuation** | both | Keep the punctuation. Off removes sof pasuq, paseq, {פ}/{ס}, commas and the like; a maqaf becomes a space. |
| **Transliteration** | Source | Add a transliteration; **Style** under it picks the scheme while it is on. Read from the fully vowelled text, so it is complete with Vowels off; with the Hebrew's Punctuation off it drops the same punctuation. |
| **Bold & italics** | Translation | **Keep** / **Drop** / **Only** the translation's own bold and italics. The Hebrew is always inserted whole, with its own. |

Vowels, Cantillation, Punctuation and Transliteration change what is fetched:
the sidebar fetches the passage again, the Preview says *Updating preview…*
and **Add Source** waits until it is done. A preference saved in the
Preferences dialog reaches an open sidebar too, except a setting changed here
for this session.

Many Hebrew fonts (David Libre, Frank Ruhl Libre, Heebo…) have no cantillation
marks. The add-on sets just the marks a font lacks in Noto Serif Hebrew (Noto
Sans Hebrew for a sans-serif font), in the insert and the preview; there is no
setting for it.

## Inserting

An insertion is a title (linked if that title's **Link title to Sefaria** is
on), then the Hebrew, transliteration and/or translation in your chosen
arrangement, then the citation if **Citation** is on, styled as set in
**Preferences → Fonts → Citation**.

With the cursor in a table cell, one language or the **Stacked** layout goes
inside the cell. **Right–Left** and **Left–Right** are tables themselves, so
they go directly below the table, and the sidebar says so. Headers, footers
and footnotes can't hold a source.

Fonts, sizes and colours come from **Preferences → Fonts**, and default to
**Match the document** — the font and size of the text where you insert.
Titles can be set to Heading 1–6 so they appear in the outline and table of
contents. Sefaria's own bold and italics are kept; change how they look under
**Preferences → Fonts → ✒️ Source Emphasis**.

**Bold & italics: Only** inserts just the words the translation puts in bold
or italics. For example, Sefaria's English Talmud (Steinsaltz) bolds the
Talmud's own words and leaves Steinsaltz's explanation plain. With **Only**, the
Berakhot 2a passage *"**From when does one recite Shema in the evening? From
the time when the priests enter** to immerse and purify themselves in order
**to partake of their teruma.**"* is inserted as *"From when does one recite
Shema in the evening? From the time when the priests enter to partake of their
teruma."* Line markers are kept. Lines with no emphasis are left out. A passage
with no emphasis anywhere, such as the Aramaic original, is inserted whole.

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
| **Sel → ס** Insert Source from Selection | Select a reference typed in the document and run it. By default the selection is replaced by the source; turn off **Preferences → Insertion → Insert from Selection** to keep it and insert below. Link Texts' Insert follows the same setting. |
| **ה → ש** Transform Divine Names | Apply your divine-name replacements to text already in the document: every match in the body of the open tab, not only a selection (headers, footers, footnotes and other tabs are left alone). It asks first. |
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
   the source's text below the paragraph, both, or neither. A citation on a
   line of its own is **replaced** by its source (titled with the citation,
   still linked), like Insert from Selection; one inside a sentence stays.
4. Optional: **📰 Customize this insertion**, under the table, has the
   Insertion Options controls (Layout and Insertion Format) plus **Replace a
   citation on its own line**. It reads *Your defaults* until you change
   something, then *Customized for this pass*. The choices apply to this pass's
   inserts only; **↺ Revert to defaults** undoes them and **💾 Save as
   defaults** makes them your Preferences.
5. Apply. The dialog reports what was linked and what couldn't be.

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
rules to text already in the document — the whole body of the open tab, not
only a selection — after asking.

## Preferences

Open with **⚙︎** or **Extensions → Torah Library → Preferences**. Preferences
are saved defaults and follow your Google account into every document. At the
top: **Interface** (Simple / Everything) and, in Simple, **Show advanced
settings**.

| Tab | Contents |
| --- | --- |
| **Fonts** | Title (a **Translation title** / **Source title** switch, each with its own font, size, style, colour, highlight and **Hyperlink formatting override** for its linked look; the paragraph style is shared), Hebrew, Transliteration (scheme), Translation (preferred language), Citation (8 pt italic in the font of the text above unless changed) — each with a preview — and ✒️ Source Emphasis (Keep / Discard / Bold only). |
| **Insertion** | Default Layout (the sidebar's pickers); Insertion Defaults for Texts, Voices and Lexicon; Transliteration Mapping; Divine Name Mappings; Insert from Selection (also used by Link Texts' Insert). |
| **Search** | Text Search Results (group order and hidden groups); Translation Languages; Advanced (Show unavailable translations). |
| **Linking** | After linking; Insert text after linking; Document scanning. |
| **Menu Bar** | Reorder, group, hide and divide menu items. |
| **🧪 Experimental** | Optional in-progress features such as Surprise Me. |

Buttons: **Reset To Defaults**, **🔁 Refresh** (reload the sidebar from saved
defaults, dropping its session changes), **Save Defaults** and **Save &
Close**. While one is working, a spinner covers the dialog and says what is
happening (*Saving preferences…*).

## The menu

**Extensions → Torah Library** holds, by default: Texts, Voices, Lexicon,
Insert Source from Selection, and a Quick Actions submenu (Quick Actions
Sidebar, Transform Divine Names, Link Texts with Sefaria, Unlink Sources,
Gematriya Count), then Preferences and Help & Support. Customize it in
**Preferences → Menu Bar**; Preferences and Help & Support always stay at the
bottom. Reload the document if a change doesn't appear. Simple mode uses a
shorter menu (see *Simple or Everything*).

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| <kbd>/</kbd> | Jump to the search box |
| <kbd>Enter</kbd> | Search, or pick the highlighted result |
| <kbd>↑</kbd> <kbd>↓</kbd> | Move through results |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> | Add Source |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | Open/close the Session Library |
| <kbd>Esc</kbd> | Close Insertion Options, the Session Library, or the Hebrew keyboard |

## Getting help

- Troubleshooting and a bug-report checklist: **Help & Support → Support**.
- Email: [help@the-merkaz.org](mailto:help@the-merkaz.org)
- [Privacy policy](./PRIVACY.md) · [Changelog](./CHANGELOG.md)

## Current limitations

- Hebrew misspelling tolerance is deferred; valid Hebrew-script references are
  supported, but typo correction is not.
- Linking is deliberately conservative: an ambiguous citation is asked about
  or skipped, never guessed.
