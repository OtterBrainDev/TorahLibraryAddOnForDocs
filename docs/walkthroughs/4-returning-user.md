# Walkthrough 4 — Coming from the original add-on

**Audience:** people who used the original *Sefaria for Google Docs* /
*Torah Library* add-on by Shlomi Helfgot, with its **Insert Source**, **Search
Texts**, **Preferences**, **Support** and **Popcorn (beta)** menu. **Time:**
15 minutes.

The short version: **what you did before still works, in one sidebar instead
of two, with a preview before anything goes into your document.** There are a
few places where the defaults are different. They're listed at the end, so
you can say what changed before anyone runs into it.

---

## 1. Where everything went (3 min)

Open **Extensions → Torah Library** and compare with the old menu.

| Original add-on | Now |
| --- | --- |
| **Insert Source** sidebar | **Texts** tab of the sidebar |
| **Search Texts** sidebar | Same **Texts** tab. References and phrase search share one box. |
| Search's **in: Tanach / Talmud / …** filter | Results are grouped by corpus. **❌** hides a group, and **⤦ Restore Corpus** brings it back. |
| Search's relevance / PageRank option | **Rel. ▾**: relevance, A–Z, Z–A, category, recent |
| **Insert source in Hebrew / English only** checkbox | **📰 Layout → Display**: **A** (translation), **A + א** (both), **א** (Hebrew) |
| **Pesukim/line markers** checkbox | **📰 Layout → Lines** |
| Version dropdowns under the source | **Versions**: Translation Versions and Original Versions |
| **Preferences** dialog | **⚙︎ Preferences**, now with tabs. Your old choices are kept. |
| Nekudot / Ta'amei HaMiqra | **Preferences → Insertion** defaults, and **Vowels** / **Cantillation** in the Layout tray for one session |
| Sheimot: replace יהוה / יה / אלוהים | **Preferences → Insertion → Divine Name Mappings**, plus English *God* |
| **Support** | **Help & Support** (always last in the menu) and **Feedback** |
| **Popcorn (beta)** | **Surprise Me**, in **Preferences → 🧪 Experimental** |

---

## 2. The same task, new way (4 min)

Do the thing everyone used the old add-on for: insert a pasuk in Hebrew and
English.

1. Cursor in the document. **Extensions → Torah Library → Texts**.
2. Type `Genesis 1:1`. **Before**, nothing happened until you'd typed a
   number, and a typo just gave you nothing. **Now** results appear as you
   type, from the title, the Hebrew (`בראשית א:א`), a traditional citation
   (`Hil. Shabbat 1:1`) or a sefaria.org link, and near-misses are offered
   under *Close matches*.
3. Click the result. **New:** the **Preview** shows exactly what will be
   inserted, with your vowel and divine-name settings already applied.
4. **Add Source** (or <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd>).

With both languages the default layout is the one you know: a two-column
table, Hebrew on the right. **📰 Layout** also offers **Stacked** (Hebrew
above English) and **Left–Right**.

---

## 3. What's new that you'll actually use (5 min)

- **Link Texts with Sefaria** (🏃 Quick Actions, or the menu). Turns the
  citations you've typed into links. It shows what it found, asks when a
  citation could mean more than one text, and tells you what it couldn't link.
  Before sending anything to Sefaria it asks, and by default it sends only the
  passages that look like citations. Tick **Insert** on a row to put the
  source's text in as well; **📰 Customize this insertion** in the review lets
  you pick the layout, vowels and so on for that batch without touching your
  Preferences.
- **Insert Source from Selection.** Select a reference you typed, e.g.
  `Psalms 92:1`, and run it. The citation becomes the source.
- **Several translations at once.** In **Versions**, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>-click
  more than one.
- **Transliteration**, in several schemes, under the Hebrew.
- **Fonts and title style.** By default sources match your document's font.
  Titles can be Headings, so they appear in the outline.
- **Voices** (search Sefaria source sheets) and **Lexicon** (the dictionary)
  tabs.
- **Session Library (📜):** what you've inserted recently, with pins and a
  **Copy References** list.
- **Transform Divine Names**, **Unlink Sources** and **Gematriya Count** in
  the Quick Actions menu.

---

## 4. What behaves differently (3 min) — say this out loud

These are the things returning users are most likely to report as bugs if
nobody warns them.

1. **Vowels on texts outside Tanakh.** The original add-on removed niqqud from
   everything except Tanakh, whatever your settings said. Now vowels appear
   wherever Sefaria has them: Mishnah, the Siddur, some commentaries. For the
   old look, turn on **Preferences → Insertion → Vowels only in Tanakh**. To
   leave vowels out of a single insert, turn **Vowels** off in **📰 Layout**.
2. **Divine-name replacement for new users is on.** New users start with
   יהוה → **יי**. If you set a replacement in the old add-on, such as ה' or
   יקוק, it has been kept. Check **Preferences → Insertion → Divine Name
   Mappings** once to make sure it's what you expect.
3. **A credit line under each source.** Each insert now ends with a small
   block naming the translation and Hebrew edition and their licenses. Many
   Sefaria texts require it. Turn it off in **Preferences → Insertion** if you
   credit sources another way.
4. **Titles aren't bold and underlined any more.** They follow your document,
   or the heading style you pick in **Preferences → Fonts → Title**. To get the
   old look, set the Title style to bold with an underline.
5. **Fonts match your document.** The old add-on used the document's default.
   Now it uses the font and size of the text where you insert. If you want one
   font everywhere, set it in **Preferences → Fonts**.
6. **Nothing is inserted until you click Add Source.** Clicking a search
   result only previews it.
7. **Insert Source from Selection replaces the selection** — and so does
   Link Texts' Insert, for a citation on a line of its own. The source is
   titled with your words, so nothing is lost. To keep your typed citation and
   put the source below it, turn off **Preferences → Insertion → Insert from
   Selection → replaces the selection** (or, in Link Texts, untick *Replace a
   citation on its own line* for one pass).
8. **Inserting inside a table.** One language, or the Stacked layout, goes
   inside the cell. The side-by-side layouts are tables themselves, so they go
   directly below the table, and the sidebar tells you so. Headers, footers
   and footnotes can't hold a source; you'll get a message.

---

## If something looks wrong

- **Help & Support → Support** has troubleshooting and a bug-report
  checklist.
- **Preferences → Reset To Defaults** puts everything back to the new
  defaults. Note that this also replaces any settings you carried over from
  the old add-on.
- Email [help@the-merkaz.org](mailto:help@the-merkaz.org).
