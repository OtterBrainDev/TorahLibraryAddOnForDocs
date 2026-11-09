# Walkthrough 4 — Coming from Sefaria for Google Docs

**Audience:** people who use Sefaria's own add-on, *Sefaria for Google Docs*
([Marketplace](https://workspace.google.com/marketplace/app/sefaria_for_google_docs/849562338091),
[Sefaria's help](https://help.sefaria.org/hc/en-us/sections/20235182393244)),
with its **Extensions → Sefaria for Google Docs** menu: **Add Sources with
Sefaria**, **Transform Divine Names** and **Link Texts with Sefaria**.
**Time:** 15 minutes.

The short version: **the same library, the same search-and-insert sidebar and
the same command names, plus saved defaults and the layout and formatting
choices that add-on doesn't have.** A few things work differently; they're
listed at the end, so you can say what changed before anyone runs into it.

Torah Library is a separate add-on (it grew from Shlomi Helfgot's original
Sefaria add-on; see `LICENSE.md`). Installing it changes nothing in Sefaria for
Google Docs, and there is nothing to carry over: that add-on keeps no settings.
Both can stay installed while people try this one; each has its own
submenu under **Extensions**.

---

## 1. Where everything went (3 min)

Open **Extensions → Torah Library** next to **Extensions → Sefaria for Google
Docs**.

| Sefaria for Google Docs | Torah Library |
| --- | --- |
| **Add Sources with Sefaria** sidebar | **Texts** tab of the sidebar (**Extensions → Torah Library → Texts**) |
| Search bar, with a dropdown of sections when you type a book name | The same box. Results appear as you type, from an English or Hebrew reference (`בראשית א:א`), a title, a traditional citation (`Hil. Shabbat 1:1`), a sefaria.org link or a phrase; near-misses come under *Close matches*. |
| A range such as `Genesis 1:1-9` | The same. |
| Format, edition and translation, chosen for each source | **📰 Insertion Options** (Display, Arrangement, Line numbers, Citation, and the Source and Translation sections) and **Versions** under the preview, for this source; your usual choice saved in **⚙︎ Preferences → Insertion**. |
| **Add Source** | **Add Source** (or <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>), after the **Preview** shows what will go in. |
| **Transform Divine Names**, choosing one of its Hebrew spellings | **🏃 Quick Actions → Transform Divine Names**, with the spellings set in **Preferences → Insertion → Divine Name Mappings** (and English *God*). |
| **Link Texts with Sefaria** sidebar, **Link Texts** button | **🏃 Quick Actions → Link Texts with Sefaria**: a review dialog. |
| Sefaria's Help Center | **Help & Support** (always last in the menu) and **Feedback**. |

---

## 2. The same task, new way (4 min)

Do the thing everyone uses the add-on for: insert a pasuk in Hebrew and
English.

1. Cursor in the document. **Extensions → Torah Library → Texts**.
2. Type `Genesis 1:1`. Results appear as you type.
3. Click the result. **New:** the **Preview** shows exactly what will be
   inserted, with your vowel and divine-name settings already applied.
   Clicking a result never inserts anything.
4. **Add Source**.

With both languages the layout is the one Sefaria for Google Docs uses: a
two-column table, Hebrew on the right. **📰 Insertion Options → Arrangement**
also offers **Left–Right** and **Stacked** (Hebrew above English), and **Line by
line** puts each verse in its own row beside its translation.

The first time the add-on opens, a short setup asks three things (what you'll
use it for, how sources should look, Simple or Everything). Pick the answers
that match how you've been working; every answer can be changed later in
Preferences, or by **Help → Quick start → Run setup again**.

---

## 3. What's new that you'll actually use (5 min)

- **Saved defaults.** Choose once in **⚙︎ Preferences** how sources go in —
  Hebrew, translation or both; arrangement; vowels; fonts — instead of for
  every source. **📰 Insertion Options** still changes them for one source.
- **Layout and formatting.** Hebrew on either side or on top; **Vowels**
  (Off / Tanakh / On) and **Cantillation** (Off / Tanakh / Torah);
  **Punctuation** for each language; **Transliteration** in several styles;
  fonts that match your document; titles as Headings, so they show in the
  outline; **Commentary** for translations that weave commentary in (keep it,
  combine it, or drop it).
- **Link Texts with Sefaria** shows what it linked, asks when a citation
  could mean more than one text, and tells you what it couldn't link. Tick
  **Insert** on a row to put the source's text in as well; **📰 Customize this
  insertion** sets the layout for that batch without touching Preferences.
- **Insert Source from Selection.** Select a reference you typed, e.g.
  `Psalms 92:1`, and run it. The citation becomes the source.
- **Several translations at once.** In **Versions**, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>-click
  more than one.
- **Voices** (search Sefaria source sheets) and **Lexicon** (the dictionary)
  tabs.
- **Session Library (📜):** what you've inserted recently, with pins and a
  **Copy References** list.
- **Settings files** (**Preferences → Advanced**, in Everything): export your
  settings and hand them to a class, or import an organization's house style.
- **Unlink Sources** and **Gematriya Count** in the Quick Actions menu.

---

## 4. What behaves differently (3 min) — say this out loud

These are the things people coming from Sefaria for Google Docs are most
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
7. **It asks for fewer permissions.** Torah Library doesn't ask to see your
   email address or profile.

Text, links and divine names that Sefaria for Google Docs already put in a
document stay as they are. Torah Library's Transform Divine Names, Link Texts
and Unlink Sources work on them like any other text.

---

## If something looks wrong

- **Help & Support → Support** has troubleshooting and a bug-report
  checklist.
- **Preferences → Reset To Defaults** puts every setting back to the
  defaults. It doesn't touch Sefaria for Google Docs.
- Email [help@the-merkaz.org](mailto:help@the-merkaz.org).
