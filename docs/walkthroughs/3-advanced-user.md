# Walkthrough 3 — Power user tour

**Audience:** people who build source sheets, shiur handouts or divrei Torah
in Google Docs every week and want to know what saves time. **Time:** 25–30
minutes. Uses the shared demo document in [`README.md`](README.md).

The flow is **set your defaults once → find fast → insert exactly what you
want → link the whole document → tidy up.**

---

## 1. Set your defaults once (5 min)

Open **⚙︎** (bottom of the sidebar) or **Extensions → Torah Library →
Preferences**. These are saved to your Google account and apply in every
document.

**Fonts tab**

- Every role (Title, Linked title, Hebrew, Transliteration, Translation)
  starts on **Match the document**: the font and size of the text where you
  insert. Leave it there if your documents already have a style. Pick a
  specific font if you want every source to look the same everywhere, e.g.
  *Frank Ruehl* or *David Libre* for Hebrew.
- **Title → paragraph style → Heading 2 or 3.** Every inserted source then
  shows up in the document outline and in a table of contents. For a long
  source sheet this is the most useful setting in the add-on.
- **Colour and highlight** default to *Auto / None* (your document decides).
  Set a colour on the translation to set it apart from your own commentary.
- **✒️ Source Emphasis:** **Keep / Discard / Keep only.** Sefaria's own bold
  and italics are kept by default. In the Steinsaltz Talmud the bold marks the
  Talmud's own words and the plain text is Steinsaltz's explanation, so
  **Keep only** inserts just the Talmud's words. **Advanced** maps bold to
  something else, such as blue text without bold. The Layout tray's **B&I**
  button switches between the three for one session.
- **Translation → preferred language** if you don't work in English.

**Insertion tab**

- **Default Display & Layout:** what the Layout tray starts on. Same pickers
  and names as the tray, shown open.
- **Divine Name Mappings:** a master switch plus a rule each for יהוה, יה,
  אלוהים and English *God*. The default is יהוה → יי. יה is matched only as a
  whole word, so יהודה is safe.
- **Insert from Selection → replaces the selection:** on by default. Turn it
  off if you'd rather keep the citation you typed and put the source below it.
  Link Texts' **Insert** follows it too (step 5).

**Menu Bar tab:** reorder, group or hide menu items. Put the three you use
most at the top. Reload the document to see the change.

> Demo tip: set Title to Heading 3 now. You'll use it in step 5.

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
| `Genesis` (whole book) | Not insertable; pick a passage |

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

Select `Genesis 1:1-5`. Open **📰 Layout**.

1. **Display:** **A** (translation), **A + א** (both), **א** (Hebrew).
2. **Layout** (for both languages): **Stacked**, **Right–Left** (a
   two-column table, Hebrew on the right) or **Left–Right**.
3. **Insertion Format:** watch the live sample change as you toggle
   **Cantillation**, **Vowels**, **Translit** (choose a scheme: Traditional,
   Academic, Modern Israeli, IPA…), **Lines** (verse numbers) and **🔗 Title**
   / **🔗 Sources**.
4. **Session:** these choices last for this sidebar only. **💾 Save as
   defaults** makes them your Preferences; **↺ Revert to defaults** undoes
   the session.

**Several translations side by side.** Open **Versions**, choose Display **A**
or Stacked layout, and <kbd>Ctrl</kbd>/<kbd>⌘</kbd>-click three translations.
**Add Source** (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>) inserts one
block each, in the order you clicked, each titled with its translation. A
translation that doesn't cover the passage is greyed out *unavailable for this
ref* and skipped. You're told when that happens.

**A specific Hebrew edition:** **Versions → Original Versions**. The credit
block under the source names the edition you chose and its license.

**The credit block** is on by default. Many Sefaria texts are CC-BY or
CC-BY-NC, so it's what lets you share the document properly. Turn it off in
Preferences → Insertion if you handle attribution yourself.

---

## 4. Other tabs (4 min)

- **Voices:** search Sefaria's public source sheets, pick one, and under
  **What to insert** choose **Citation**, **Text** or **Both**. It's a quick
  way to borrow someone's sheet structure.
- **Lexicon:** type a Hebrew or Aramaic word (or an English one for a reverse
  lookup). Insert as **Full entry**, **Word + ref** or **Definition**. **⭐**
  keeps entries under *Starred entries*.
- **⌨︎ Hebrew keyboard** with a vowels row, for when your OS keyboard isn't
  set up for Hebrew.
- **📜 Session Library** (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd>):
  everything you inserted recently. **📌** pins a source; **Copy References**
  gives you a plain-text list for a bibliography or an email.

---

## 5. Link a whole document (6 min)

This works on a document you wrote yourself, full of citations you typed.

1. **🏃 Quick Actions → 🔗 → ס Link Texts with Sefaria** (or the menu).
2. The first time, it asks before sending anything. By default only passages
   that **look like citations** are sent; the rest of your writing stays in
   the document.
3. The review table lists each citation, where it will link, and an excerpt.
   An **ambiguous** citation (e.g. `Avodah Zarah 2a`: the Talmud or a
   commentary?) has a dropdown and is left unticked until you choose.
4. Each row has **Link** and **Insert**. Tick **Insert** on a couple of rows,
   and the full text of those sources goes in below their paragraphs. A
   citation on a line of its own is **replaced** by its source, titled with
   your words and still linked, so it isn't repeated; one inside a sentence
   stays. With Title set to Heading 3 in step 1, your outline now lists them.
5. Want these sources different from your usual? Open **📰 Customize this
   insertion** under the table: the Layout tray's controls (Display, Layout,
   vowels, transliteration, Lines, Sources, B&I) plus **Replace a citation on
   its own line**, for this pass only. Try **א** with vowels off for a
   handout. **💾 Save as defaults** if you want to keep it; otherwise your
   Preferences are untouched.
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
  already in the document, including text you pasted from elsewhere.
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
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>-click | Select several translations |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | Session Library |
| <kbd>Esc</kbd> | Close the Layout tray, Session Library or keyboard |

## Things worth knowing

- **Tables:** one language or Stacked goes inside the cell; Right–Left and
  Left–Right go directly below the table, with a message saying so. Headers,
  footers and footnotes can't hold a source.
- **Vowels only in Tanakh** (Preferences → Insertion) keeps niqqud in Tanakh
  and drops it everywhere else.
- The Session Library is kept in your browser, so it doesn't follow you to
  another computer. Preferences do.
