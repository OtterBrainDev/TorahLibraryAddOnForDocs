# Walkthrough 3 — Power user tour

**Audience:** people who build source sheets, shiur handouts or divrei Torah
in Google Docs every week and want to know what saves time. **Time:** 25–30
minutes. Uses the shared demo document in [`README.md`](README.md).

The flow is **set your defaults once → find fast → insert exactly what you
want → link the whole document → tidy up.**

---

## 1. Set your defaults once (5 min)

Open **⚙︎** (bottom of the sidebar; it says *Opening Preferences…* while it
loads) or **Extensions → Sefaria for Google Docs → Preferences**. These are saved to
your Google account and apply in every document.

At the top, **Interface** should be **Everything**. **Simple** hides the result
sort, Restore Corpus and 🧪 in the sidebar, plus the Search, Linking, Advanced
and Experimental tabs and the Profiles column here. This tour uses Everything.

**Insertion tab: fonts and titles**

Every font is set beside what it styles. In **Insertion Defaults → Texts**,
each **Title font** and **Text font** button (in the Source and the
Translation section), and the transliteration's **Font** under its Style,
opens that font's full settings in place: font, size, bold / italic /
underline, colour, highlight and a preview. **Layout → Citation style** does
the same for the citation.

- Every role (titles, Hebrew, transliteration, translation, citation)
  starts on **Match the document**: the font and size of the text where you
  insert. Leave it there if your documents already have a style. Pick a
  specific font if you want every source to look the same everywhere, e.g.
  *Noto Serif Hebrew* for Hebrew. Any Hebrew font works: *David Libre* and
  *Frank Ruhl Libre* have no cantillation, so the add-on always sets just the
  marks a font lacks in Noto Serif Hebrew (Noto Sans Hebrew for a sans-serif
  font). There's no setting; Help → Insertion Options → *Fonts and
  cantillation marks* explains it.
- **Layout → Title style → Heading 2 or 3.** Every inserted source then
  shows up in the document outline and in a table of contents. For a long
  source sheet this is the most useful setting in the add-on. The title
  style is shared; the font is not: each title's **Title font** gives it its
  own font, size, colour and highlight.
  **Hyperlink formatting override** there (on by default) gives a title a
  separate look while it's linked; off, a linked title keeps its title font.
  Under each **Link title to Sefaria**, **Name the edition in the title**
  (Source) and **Name the translation in the title** (Translation), on by
  default, write a linked title as
  *Genesis 1:1 (Translation • The Koren Jerusalem Bible)*; off, just
  *Genesis 1:1*, still linked.
- **Citation style:** the editions-and-licenses line under each source has
  its own style, 8 pt italic in the font of the text above unless you change
  it. *Same as the text above* and a blank size follow the passage.
- **Colour and highlight** default to *Auto / None* (your document decides).
  Set a colour on the translation to set it apart from your own commentary.
- **Commentary** (Translation section): **Default / Combine / Drop.**
  Default preserves the edition's words and markings. In the **William
  Davidson Edition - English** of the Babylonian Talmud, bold marks the
  Talmud's words and plain text its explanation: Combine removes the bold;
  Drop keeps the bold base text. Retained words keep their italics.
  **The Rashi chumash by Rabbi Shraga Silverstein** and **The Rashi Ketuvim
  by Rabbi Shraga Silverstein** instead mark additions with square brackets:
  Combine removes those brackets; Drop removes the additions. Other editions
  keep their words and source emphasis, and a malformed Silverstein verse
  stays whole. The help under Commentary identifies the current convention.
  **Advanced** under it maps bold to something else, such as blue text
  without bold. The sidebar's Insertion Options has the same control for one
  session. It applies to the translation only; the Hebrew always keeps its
  own bold and italics.
- **Notes** (Layout): **Omit / Inline / Separate**, independently of
  Commentary. Omit is the default and leaves out marked source footnotes in
  either language. Inline includes them in parentheses. Separate collects
  labelled notes below the passage, or below each line with Line by line.
  These are ordinary text sections, not native Google Docs footnotes.
- **Language** (Translation section): the preferred translation language, if
  you don't work in English.

**Insertion tab: the rest**

- **Layout** and **Insertion Defaults → Texts:** what Insertion Options
  starts on. The same controls as the sidebar, with the Source and
  Translation sections shown open.
- **Divine Name Mappings:** a master switch plus a rule each for יהוה, יה,
  אלוהים and English *God*. The default is יהוה → יי. יה is matched only as a
  whole word, so יהודה is safe.
- **Insert from Selection → replaces the selection:** on by default. Turn it
  off if you'd rather keep the citation you typed and put the source below it.
  Link Texts' **Insert** follows it too (step 5).

**Menu Bar tab:** reorder, group or hide menu items. Put the three you use
most at the top; **Move to Quick Actions ▸** tucks the rest into the submenu.
Reload the document to see the change.

**Search tab:** the order of the Texts result groups, of the **Voices Topics**
and of the **Lexicon Dictionaries**, and which of each to leave out (a chip in
the sidebar brings one back for a single search).

**Sidebar tab:** switch off what you never use: the Voices or Lexicon tab, a
Quick Actions button, or (handy for a class) an Insertion Options control,
which keeps its current value, including any existing session override.
Use **Revert** before hiding controls if the class should start from saved
defaults.

**Profiles** (the column beside the tabs): **+ New profile** copies your
settings into a second profile, say *Beginners* with transliteration on, and
your first becomes *My settings*. Click one to switch; with two or more, the
sidebar's **📰 Insertion Options** has a **Profile** list for switching
mid-lesson. A profile holds how sources look; the menu, the sidebar, search
and linking stay the same in each.

**Advanced tab:** **Export settings file** hands your settings to a class or a
colleague; **Choose a settings file…** applies the parts you tick of theirs.

> Demo tip: set Layout → Title style to Heading 3 now. You'll use it in step 5.

---

## 2. Find fast (5 min)

Open **Texts** and press <kbd>/</kbd> to jump to the search box. Try:

| Type | Shows |
| --- | --- |
| `berakhot 2a` | Talmud by daf |
| `ברכות ב.` or `בראשית א׳:א׳` | Hebrew references, with geresh and gershayim |
| `Hil. Shabbat 1:1`, `Rambam, Hil. Teshuvah 3:4` | Traditional citations expand to *Mishneh Torah, Hilchot…* |
| `the torah a womens commentary deuteronomy 29 9-14` | Titles match whatever the punctuation or capitalisation |
| `https://www.sefaria.org/Genesis.1.1` | Paste a Sefaria link |
| `in the beginning` | Phrase search across the library |
| `Genesis` (whole book) | Opens at its first chapter: the preview is titled *Genesis 1*, and Add Source inserts that chapter only |
| `Mishneh Torah` (a heading with no text) | Not insertable; pick a passage |

- <kbd>↑</kbd>/<kbd>↓</kbd> then <kbd>Enter</kbd> picks a result without the
  mouse.
- **Close matches** appear after the exact results when you've made a typo or
  left out a word. Click the one you meant; they're never picked for you.
- **A א** filters to works with a translation in a language you choose.
  **Rel. ▾** sorts. **❌** hides a whole group, and **⤦ Restore Corpus**
  brings it back.
- Click into an empty search box to see recent searches.
- **‹ Prev / Next ›** on the selected source move to the neighbouring passage.
  Useful for building a sequence.

---

## 3. Insert exactly what you want (8 min)

Select `Genesis 1:1-5`. Open **📰 Insertion Options**.

1. **Display:** the labels **Translation**, **Both**, and **Original** sit
   beside the A / A + א / א icons.
2. **Arrangement**, with Both: **Stacked**, **Hebrew right**, or **Hebrew left**.
   **Line by line** stays visible directly below: each verse gets a table row
   beside its translation, or in Stacked, the verse and its translations down
   the page. Turn on **Transliteration** beside it to reveal **Style**; a
   side-by-side bilingual arrangement also reveals **Position** (Below, Left,
   Right of the Hebrew). The icons sketch the result.
3. Open **Text and notes** for the text samples and language controls:
   **Vowels: Off / Tanakh / On**, **Cantillation: Off / Tanakh / Torah**,
   separate Hebrew and Translation punctuation, **Commentary** and **Notes**.
   Punctuation Off also affects transliteration; Vowels Off does not stop
   transliteration from using the fully vowelled source.
4. Open **References and numbering** for **Link source title** and
   **Link translation title**, plus **Citation** and **Line numbers**.
   Open **Fonts and appearance** for the source/translation title and text
   fonts. Each button opens Font and Size; *Colour, style and more…* opens
   Preferences. Closing a group changes nothing. Its summary keeps the
   current Notes, Commentary, credit, numbering, font and size choices clear.
5. **Session:** these choices last for this sidebar. The session explanation
   remains above the scrolling controls. **💾 Save as defaults** keeps the
   changes; **↺ Revert** restores saved Preferences. Fetch-time changes
   (Vowels, Cantillation, Punctuation, Transliteration) show *Updating
   preview…* and Add Source waits. The translation, Hebrew edition and
   multi-translation order stay selected. Explicitly hidden controls stay
   hidden, but hiding them does not discard an earlier session override.

The primary controls require no group expansion; controls for a language not
being inserted disappear. Notes still applies to either language. Try the
Style menu with the keyboard: arrows browse, Enter selects, and Esc dismisses
only the menu. Selecting None returns focus to the Transliteration switch.
Preferences and Link Texts retain their more detailed Source and Translation
sections using these shared settings.

**Several translations at once.** Open **Versions**, choose Display **A** or
Stacked layout, click one translation, and <kbd>Ctrl</kbd>/<kbd>⌘</kbd>-click two
more. Plain-click replaces; Shift-click selects a range. **Add Source**
(<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>) inserts one block each, in the
order you clicked, each titled with its translation. With **Line by line** on
in Stacked, each verse is followed by that verse in each translation instead.
A translation that doesn't cover the passage isn't listed (Preferences →
Search → Advanced → *Show unavailable translations* lists it greyed out). To
find one in a long list, type its language in the filter box: *German*,
*Deutsch* or *de*.

**A specific Hebrew edition:** **Versions → Original Versions**. The credit
block under the source names the edition you chose and its license.

**Partial editions:** a listed translation may cover some, but not all, of
the passage. Missing verses stay missing; the add-on does not borrow another
edition's words under that credit. If an edition needed for the selected
Display is unavailable, the notice asks you to choose another and Add Source
stays disabled.
Sefaria can also return a different edition catalog for a different passage.

**Optional two-minute comparison:** select `Genesis 1:1`, choose **The Rashi
chumash by Rabbi Shraga Silverstein**, and compare Default, Combine and Drop.
Change Vowels once: the edition must stay selected. Next choose **THE JPS
TANAKH: Gender-Sensitive Edition**,
and compare Notes Omit, Inline and Separate with Commentary Drop. The main
verse must remain; the note follows Notes. Insert one example to check
the note placement in the document; the preview does not show document
pagination or generated line numbers. Restore your defaults afterwards.

**The credit block** (**Citation**) is on by default. Many Sefaria texts are
CC-BY or CC-BY-NC, so it's what lets you share the document properly. Switch
it off in Insertion Options for one session, or in Preferences → Insertion →
Layout, if you handle attribution yourself.

---

## 4. Other tabs (4 min)

**Texts / Voices / Lexicon** sit under the search box. Type `shabbat` and
press <kbd>Enter</kbd>: Texts searches, and Voices and Lexicon search in the
background, so each tab's number shows its results. Switching tabs never
searches, and each tab keeps its results and what you'd selected.

- **Voices:** Sefaria's public source sheets, grouped by topic (Torah
  Portions, Shabbat & Holidays, Halakhah…). A topic chip, or a group's **❌**,
  hides it for this search. Pick a sheet, and under **What to insert** choose
  **Citation**, **Text** or **Both**; a **Transliteration** puts each Hebrew
  passage's transliteration after it in parentheses. **Add Sheet**. It's a
  quick way to borrow someone's sheet structure.
- **Lexicon:** type a Hebrew or Aramaic word (or an English one for a reverse
  lookup), say `שם`. The results are words: **Matches**, then **Related
  words**. A dictionary chip hides that dictionary's entries. Pick a word, then
  click the entries you want from several dictionaries (Klein *and* BDB), in
  the order they should go in. Insert as **Full entry**, **Word + ref** or
  **Definition** with **Add Entry**; **Copy** gives the same text.
- **⌨︎ Hebrew keyboard** with a vowels row, for when your OS keyboard isn't
  set up for Hebrew.
- **📜 Session Library** (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>):
  everything you inserted recently. **📌** pins a text, a sheet or a word;
  clicking one reopens it in its own tab. **Copy References** gives you a
  plain-text list for a bibliography or an email.

---

## 5. Link a whole document (6 min)

This works on a document you wrote yourself, full of citations you typed.

1. **🏃 Quick Actions → 🔗 → ס Link Texts with Sefaria** (or the menu).
2. A dialog shows progress while it scans. By default only passages that
   **look like citations** are sent; the rest of your writing stays in the
   document.
3. The review table lists each citation, where it will link, and an excerpt.
   An **ambiguous** citation (e.g. `Avodah Zarah 2a`: the Talmud or a
   commentary?) has a dropdown and is left unticked until you choose.
4. Each row has **Link** and **Insert**. Tick **Insert** on a couple of rows,
   and the full text of those sources goes in below their paragraphs. A
   citation on a line of its own is **replaced** by its source, titled with
   your words and still linked, so it isn't repeated; one inside a sentence
   stays. With Title set to Heading 3 in step 1, your outline now lists them.
5. Want these sources different from your usual? Open **📰 Customize this
   insertion** under the table: the settings from Insertion Options, arranged
   here in the detailed Layout, Source and Translation sections
   (Display, Arrangement, Citation, Line numbers, both Link title switches,
   Vowels, Cantillation, Punctuation, Transliteration, Commentary, Notes) plus
   **Replace a citation on its own line**, for this pass only. It says *Your
   defaults* until you change something, then *Customized for this pass*. Try
   **א** with Vowels **Off** for a handout. **💾 Save as defaults** if you want
   to keep it; otherwise your Preferences are untouched.
6. The report tells you what was linked, what needed a choice and what
   couldn't be resolved.

**Preferences → Linking** decides how much it asks:

- **Show a summary, and ask about ambiguous citations** (default).
- **Show every match for review.**
- **Just link and report a count**, with **Insert text after linking** as an
  option. Good for a document you've linked before.
- **Document scanning → Whole document** if the report says some citations
  *could not be placed*.

Run it again later on the same document: anything already linked is left
alone.

---

## 6. Tidy up (2 min)

- **Insert Source from Selection** (**Sel → ס**): type `Psalms 92:1` in your
  notes, select it, run it, and the citation becomes the source.
- **Transform Divine Names** (**ה → ש**): apply your divine-name rules to text
  already in the document, including text you pasted from elsewhere. It changes
  every match in the body of the tab you have open — a selection does not limit
  it; headers, footers, footnotes and other tabs are left alone — and asks first.
- **Unlink Sources** (menu): removes every sefaria.org link and leaves other
  links alone. Useful before printing.
- **Gematriya Count** (menu): the gematria total of the selection or the whole
  document.

---

## Keyboard reference

| Keys | Action |
| --- | --- |
| <kbd>/</kbd> | Search box |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd> | Move through and pick results |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> | Add Source |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | Session Library |
| <kbd>Esc</kbd> | Close Insertion Options, the Session Library or the keyboard |

## Things worth knowing

- **Tables:** one language or Stacked goes inside the cell; Hebrew right and
  Hebrew left go directly below the table, with a message saying so. Headers,
  footers and footnotes can't hold a source.
- **Vowels: Tanakh** (Insertion Options, or Preferences → Insertion for
  good) keeps niqqud in Tanakh and drops it everywhere else, as the original
  add-on did.
- Saving in Preferences shows *Saving preferences…* over the dialog until it's
  done, and the change reaches an open sidebar. A setting you changed for the
  session in Insertion Options keeps its session value until **↺ Revert**.
- The Session Library is kept in your browser, so it doesn't follow you to
  another computer. Preferences do.
