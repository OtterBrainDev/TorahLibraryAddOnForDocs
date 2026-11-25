# Walkthrough 4 — Coming from version 1.0

**Audience:** people who use version 1.0 of *Sefaria for Google Docs*
([Marketplace](https://workspace.google.com/marketplace/app/sefaria_for_google_docs/849562338091),
[Sefaria's help](https://help.sefaria.org/hc/en-us/sections/20235182393244)),
with its **Extensions → Sefaria for Google Docs** menu: **Add Sources with
Sefaria**, **Transform Divine Names** and **Link Texts with Sefaria**.
**Time:** 15 minutes.

The short version: **the same library, the same search-and-insert sidebar and
the same command names, plus saved defaults and the layout and formatting
choices version 1.0 doesn't have.** A few things work differently; they're
listed at the end, so you can say what changed before anyone runs into it.

Version 2.0 is the same add-on, updated in place (it grew from Shlomi
Helfgot's original code; see `LICENSE.md`). There is nothing to carry over:
version 1.0 keeps no settings. Until 2.0 is released, a tester who has 1.0
installed sees two **Sefaria for Google Docs** submenus under **Extensions**:
the published 1.0 and the test deployment of 2.0.

---

## 1. Where everything went (3 min)

Open **Extensions → Sefaria for Google Docs**. In a test deployment, open the
2.0 submenu next to the published 1.0 one.

| Version 1.0 | Version 2.0 |
| --- | --- |
| **Add Sources with Sefaria** sidebar | **Texts** tab of the sidebar (**Extensions → Sefaria for Google Docs → Texts**) |
| Search bar, with a dropdown of sections when you type a book name | The same box. Results appear as you type, from an English or Hebrew reference (`בראשית א:א`), a title, a traditional citation (`Hil. Shabbat 1:1`), a sefaria.org link or a phrase; near-misses come under *Close matches*. |
| A range such as `Genesis 1:1-9` | The same. |
| Format, edition and translation, chosen for each source | **📰 Insertion Options** (Display, Arrangement, Line by line and Transliteration at the top, with three folding groups for other choices) and **Versions** under the preview, for this source; your usual choice saved in **⚙︎ Preferences → Insertion**. |
| **Add Source** | **Add Source** (or <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>), after the **Preview** shows what will go in. |
| **Transform Divine Names**, choosing one of its Hebrew spellings | **🏃 Quick Actions → Transform Divine Names**, with the spellings set in **Preferences → Insertion → Divine Name Mappings** (and English *God*). |
| **Link Texts with Sefaria** sidebar, **Link Texts** button | **🏃 Quick Actions → Link Texts with Sefaria**: a review dialog. |
| Sefaria's Help Center | **Help & Support** (always last in the menu) and **Feedback**. |

---

## 2. The same task, new way (4 min)

Do the thing everyone uses the add-on for: insert a pasuk in Hebrew and
English.

1. Cursor in the document. **Extensions → Sefaria for Google Docs → Texts**.
2. Type `Genesis 1:1`. Results appear as you type.
3. Click the result. **New:** the **Preview** shows the selected passage,
   with your vowel and divine-name settings already applied.
   Clicking a result never inserts anything.
4. **Add Source**.

With both languages the layout is the one version 1.0 uses: a
two-column table, Hebrew on the right. **📰 Insertion Options → Arrangement**
also offers **Hebrew left** and **Stacked** (Hebrew above English), and **Line by
line** pairs each verse with its translation: side by side, in its own row;
Stacked, the verse and then its translation, down the page.

The first time the add-on opens, a short setup asks three things (what you'll
use it for, how sources should look, Simple or Everything). Choose **I've used
Sefaria for Google Docs**: it starts the next screens on version 1.0's look
(both languages, Hebrew on the right, a simple menu), and a note under *God's
name* explains that the name is now replaced as sources go in. Every answer
can be changed there, later in Preferences, or by **Help → Quick start → Run
setup again**.

---

## 3. What's new that you'll actually use (5 min)

- **Saved defaults.** Choose once in **⚙︎ Preferences** how sources go in —
  Hebrew, translation or both; arrangement; vowels; fonts — instead of for
  every source. **📰 Insertion Options** changes them for this sidebar
  session; **Save as defaults** keeps those changes for future sessions.
- **Layout and formatting.** Hebrew on either side or on top; **Vowels**
  (Off / Tanakh / On) and **Cantillation** (Off / Tanakh / Torah);
  **Punctuation** for each language; **Transliteration** in several styles;
  fonts that match your document; titles as Headings, so they show in the
  outline; **Commentary** for the Davidson English Talmud and Silverstein's
  Rashi Chumash and Rashi Ketuvim (keep, combine or drop their explanation).
  Other editions keep their words. **Notes** separately omits marked source
  footnotes, puts them inline, or collects them under the passage.
- **Link Texts with Sefaria** shows what it linked, asks when a citation
  could mean more than one text, and tells you what it couldn't link. Tick
  **Insert** on a row to put the source's text in as well; **📰 Customize this
  insertion** sets the layout for that batch without touching Preferences.
- **Insert Source from Selection.** Select a reference you typed, e.g.
  `Psalms 92:1`, and run it. The citation becomes the source.
- **Several translations at once.** With Translation only or Stacked,
  Ctrl/Cmd-click in **Versions** adds or removes a translation, and Shift-click
  selects a range. A plain click selects only one. The filter box
  finds a language by name (*French*, *français*, *צרפתית*).
- **Voices** (search Sefaria source sheets, grouped by topic) and **Lexicon**
  (the dictionary: pick a word, then the dictionaries' entries you want)
  tabs. Each tab keeps its own results; **Enter** searches all three.
- **Session Library (📜):** what you've inserted recently, with pins (texts,
  sheets and words) and a **Copy References** list.
- **Settings files** (**Preferences → Advanced**, in Everything): export your
  settings and hand them to a class, or import an organization's house style.
- **Profiles** (Everything): a look for each class, switched in a click in
  Preferences or the sidebar's Insertion Options.
- **Unlink Sources** and **Gematriya Count** in the Quick Actions menu.

---

## 4. What behaves differently (3 min) — say this out loud

These are the things people coming from version 1.0 are most
likely to report as bugs if nobody warns them.

1. **Divine names are replaced as you insert.** Out of the box יהוה becomes
   **יי** in every new source; you don't run Transform Divine Names afterwards.
   The setup asks about it; change it later in **Preferences → Insertion →
   Divine Name Mappings**, or turn **Apply Divine-Name Replacements On
   Insertion** off to insert the name as Sefaria has it. **Transform Divine
   Names** asks before it changes anything, names what it will change, and
   works on the body of the tab you have open (not headers, footers,
   footnotes or other tabs).
2. **Link Texts tells you what it did.** It links the citations it is sure
   of, then shows a summary, asks when a citation could mean more than one
   text, and lists what it couldn't link. By default it sends Sefaria only the
   passages that look like citations. **Preferences → Linking** can review
   every match before linking, just link and report a count, or send the
   whole document.
3. **A credit line under each source.** Each insert ends with a small block
   naming the translation and Hebrew edition and their licenses, which many
   Sefaria texts require. Turn **Citation** off in **📰 Insertion Options** or
   **Preferences → Insertion → Layout** if you credit sources another way, or
   restyle it with **Citation style**.
4. **Fonts match your document.** Sources take the font and size of the text
   where you insert. To use one font everywhere, set it with the font buttons
   in **Preferences → Insertion → Insertion Defaults**.
5. **Insert Source from Selection replaces the selection** — and so does
   Link Texts' Insert, for a citation on a line of its own. The source is
   titled with your words, so nothing is lost. To keep your typed citation and
   put the source below it, turn off **Preferences → Insertion → Insert from
   Selection → replaces the selection** (or, in Link Texts, untick *Replace a
   citation on its own line* for one pass).
6. **Inserting inside a table.** One language, or the Stacked layout, goes
   inside the cell. The side-by-side layouts are tables themselves, so they go
   directly below the table, and the sidebar tells you so. Headers, footers
   and footnotes can't hold a source; you'll get a message.
7. **It asks for fewer permissions.** Version 2.0 doesn't ask to see your
   email address or profile.
8. **An edition's gaps stay gaps.** The selected edition supplies its own
   words, without filling missing verses from another translation. Choose a
   different edition in **Versions** if you need one that covers more of the
   passage. An unavailable edition needed for your Display shows a notice
   and keeps Add Source disabled until you choose an available edition.
9. **Commentary and Notes are separate.** Start with **Commentary: Default**
   and **Notes: Omit**, the defaults. Default keeps explanation and its
   markings; Omit leaves out marked footnotes, as the previous insertion
   path did. A bold quotation in a JPS footnote is controlled by Notes, not
   Commentary. **Separate** creates a labelled text section, not a native
   Google Docs footnote.

For the simplest workflow, leave Insertion Options closed after choosing
Display and Arrangement. **Simple** shortens the menu and search tools; it
does not reduce the options inside this panel. Its primary controls stay
visible when applicable; **Text and notes**, **References and numbering**, and
**Fonts and appearance** start folded and summarize current settings.
In Everything, **Preferences → Sidebar** can hide controls you never use,
then you can return to Simple. Hiding a control preserves its current value,
including an existing session override; use **Revert** first if you want saved
defaults.

Text, links and divine names that version 1.0 already put in a
document stay as they are. Transform Divine Names, Link Texts
and Unlink Sources work on them like any other text.

---

## If something looks wrong

- **Help & Support → Support** has troubleshooting and a bug-report
  checklist.
- **Preferences → Reset To Defaults** puts every setting back to the
  defaults. It doesn't touch your documents.
- [Sefaria's Help Center](https://help.sefaria.org/hc/en-us/sections/20235182393244).
