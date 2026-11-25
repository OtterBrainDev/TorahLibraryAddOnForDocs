# Using Sefaria for Google Docs

A walkthrough of the add-on as it is today (v2.0; see the
[changelog](./CHANGELOG.md)). The same material is inside
the add-on under **Extensions → Sefaria for Google Docs → Help & Support**, or the
**Help** button at the bottom of the sidebar.

This copy describes the current source. Release and live-test status are
recorded in the [project handoff](sefaria-api-migration.md); these instructions
do not establish that a Marketplace release or a recorded tutorial exists.

## Quick start

1. Put your cursor where the source should go.
2. Open **Extensions → Sefaria for Google Docs → Texts**. The sidebar opens on the right.
3. Type a reference — `Genesis 1:1`, `Berakhot 2a`, `בראשית א:א`. Results
   appear as you type.
4. Click a result. The **Preview** shows the passage with your text choices.
5. Optional: open **📰 Insertion Options** to choose Hebrew, translation or both, and how
   they are arranged.
6. Click **Add Source** (or press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd>).

The first time a new user opens the add-on, a three-step setup asks what it is
for, how sources should look (with a preview) and how much of the add-on to
show. Every answer starts at the current setting, so clicking through changes
nothing. **Help & Support → Quick start → Run setup again** reopens it.

## Coming from version 1.0

If you used version 1.0, the basics are familiar: the same library, the same
search-and-insert sidebar, and commands with the same names. The update
changes nothing in your documents. Version 1.0 kept no settings, so version
2.0 starts from its own defaults.

| Version 1.0 | Version 2.0 |
| --- | --- |
| **Extensions → Sefaria for Google Docs** | The same menu, with more in it (rearrange it in Preferences → Menu Bar) |
| **Add Sources with Sefaria** | **Texts**: type a citation (ranges such as `Genesis 1:1-9` work) or a title, click a result, check the **Preview**, **Add Source** |
| Format, edition and translation, picked for each source | **📰 Insertion Options** and **Versions** for this source; saved defaults in **Preferences** |
| **Transform Divine Names** | **Quick Actions → Transform Divine Names**, with the spellings set in Preferences → Insertion → Divine Name Mappings |
| **Link Texts with Sefaria** | **Quick Actions → Link Texts with Sefaria** |

**The same:** Hebrew and translation go in as a two-column table, Hebrew on
the right. Text and links version 1.0 inserted stay as they are, and
Transform Divine Names, Link Texts and Unlink Sources work on
them like any other text.

**New:** saved defaults (a short setup the first time, where **I've used
Sefaria for Google Docs** starts from the look you know; Help → Quick start →
**Run setup again**); arrangement, vowels, cantillation, punctuation,
transliteration, fonts and heading titles; **Commentary** for supported
Davidson Talmud and Silverstein Tanakh editions; separate **Notes** choices
for marked footnotes; Insert Source from Selection; Voices, Lexicon and the
Session Library; several translations at once; settings files (Preferences →
Advanced) and profiles, one look per class.

**Different:**

1. **Divine names are replaced as you insert:** out of the box יהוה becomes
   **יי**. Choose the spelling, or turn it off, in the setup or in Preferences →
   Insertion → Divine Name Mappings. Transform Divine Names asks first and
   works on the tab you have open.
2. **Link Texts tells you what it did:** it links what it is sure of, asks
   about citations that could mean more than one text, and lists what it
   couldn't link. It sends Sefaria only the passages that look like citations.
3. **A credit line under each source** names the editions and their licenses;
   turn **Citation** off if you credit sources another way.
4. **Clicking a result only previews it;** nothing goes in until **Add Source**.
5. **It asks for less:** no access to your email address or profile.

More help is in Sefaria's Help Center, at
[help.sefaria.org](https://help.sefaria.org/hc/en-us/sections/20235182393244).

## The sidebar at a glance

**The search box**

| Control | What it does |
| --- | --- |
| **⌨︎** | On-screen Hebrew keyboard, with a Vowels row. |
| **🔍** | Run the search. Click into the empty search box to see recent searches. |

**Under the search box**, three tabs choose the kind of result. Each keeps its
own results; switching never searches (see *Texts, Voices and Lexicon tabs*
below).

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

- **Sidebar:** the result sort, **⤦ Restore Corpus** and the **🧪** tab. The
  Texts / Voices / Lexicon tabs, Add Source, Insertion Options and the footer
  buttons stay in both modes.
- **Menu:** a shorter menu — Texts, Insert Source from Selection, Transform
  Divine Names, Link Texts with Sefaria, then Preferences and Help & Support.
  Switching back to Everything restores the menu you had.
- **Preferences:** the Search, Linking, Advanced and 🧪 Experimental tabs and
  the advanced formatting sections (formatting for specific languages, how
  kept bold and italics look). Switch to **Everything** to see them; the switch
  never changes a setting.

In either interface, **Preferences → Sidebar** leaves out what you don't use:
the Voices and Lexicon tabs, Quick Actions buttons, and (in Everything)
Insertion Options controls; hiding one keeps its current value, including a
session override. Anything
switched off is hidden, not removed: a tab's menu item still opens it.

Everything also has **profiles** (see *Profiles* below).

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
translation language is set in **Preferences → Insertion → Insertion
Defaults → Translation → Language**.

Changing Insertion Options keeps the chosen translation, Hebrew edition and
order of multiple translations. Add Source waits while a refresh is loading.

With **Translation** only, or **Hebrew and translation** in the **Stacked**
layout, a plain click selects just one translation. Use
<kbd>Ctrl</kbd>/<kbd>⌘</kbd>-click to add or remove individual translations,
<kbd>Shift</kbd>-click to select a visible range, or both modifiers to extend
the selection. Each is inserted as its own block, in selection order; new
range picks are added in list order. The Preview can't show several at once;
it lists them in that order. One always stays selected. Typing in the filter
box never changes the selection; a plain or Shift-click replaces hidden picks
as well as visible ones.

The filter box finds a language by its name, in English, in itself or in any
other language the add-on lists: *French*, *français* and *צרפתית* all list
the French translations. The first few letters are enough; capitals, accents
and vowel points don't matter. A code (*fr*) works too, and so does part of a
version's title.

A catalogued translation with no text for the passage is left out of the
list. **Preferences → Search → Advanced → Show unavailable translations**
shows known unavailable entries greyed out. Sefaria may omit editions from a
passage's catalog entirely, so this is not necessarily every edition of the
book. Languages unticked in **Preferences → Search → Translation Languages**
are left out too.

An edition may cover only some verses. Its gaps stay gaps: another edition's
words are not borrowed under the selected edition's credit. If an edition
needed for the selected Display is unavailable, the pickers remain visible
and Add Source waits for a valid choice.

An explicit Display language with no text cannot insert an empty block;
choose the available language or Both. If Commentary/Notes leaves no content,
insertion stops before changing the document. With several translations, an
edition emptied by those choices is omitted with a notice and stays available
for different options.

**🔁 Preview** uses the same words, Commentary and Notes rules as insertion.
Generated line numbers, chapter headings, final document fonts and page
breaks are checked in the document. With several translations picked, the
preview lists their names rather than rendering them all.

## Insertion Options (📰)

Everything here applies to the current sidebar session. A short explanation
stays above the scrolling controls; **↺ Revert** restores saved Preferences,
and **💾 Save as defaults** keeps session choices for later sessions. These
actions become available when something differs. With two or more profiles, the
**Profile** list switches between them. Simple and Everything use the same
panel; **Preferences → Sidebar** can hide individual controls.

Revert, Save as defaults and profile changes wait for any setting still
saving. If saving fails after a retry, insertion pauses with your choices
still visible. Change an option to retry, or choose Revert to restore saved
defaults.

**The controls at the top**

- **Display:** **Translation**, **Both**, or **Original**, labelled beside
  the A / A + א / א icons.
- **Arrangement**, with Both: **Stacked**, **Hebrew right**, or **Hebrew left**.
- **Line by line**, with Both, remains visible in every arrangement. Side by
  side, each verse gets its own table row. Stacked, each verse is followed by
  its transliteration and translations in the order picked.
- **Transliteration**, with Original or Both, stays outside the folded groups.
  Turn it on to reveal **Style**. In side-by-side bilingual layouts,
  **Position** offers Below, Left, or Right of the Hebrew. Stacked always
  keeps it under the Hebrew. The Arrangement icons sketch these choices.

**The three folded groups**

Their summaries show active choices, including Notes, Commentary, credits,
line numbers, title links, fonts and sizes. Open a group to change a setting;
closing it does not change values or fetch the passage again.

| Group | Controls and behavior |
| --- | --- |
| **Text and notes** | **Vowels:** Off / Tanakh / On. **Cantillation:** Off / Tanakh / Torah. **Hebrew punctuation** and **Translation punctuation** are independent. **Commentary:** Default / Combine / Drop, following the supported conventions below. **Notes:** Omit / Inline / Separate for marked source footnotes in either language. |
| **References and numbering** | **Link source title** and **Link translation title** independently link each title to Sefaria. **Citation** adds the editions and licenses below the passage. **Line numbers** numbers each verse or line; chapter crossings add headings. |
| **Fonts and appearance** | **Source title**, **Hebrew text**, **Translation title** and **Translation text** buttons open Font and Size. A blank size matches the text where you insert. **Colour, style and more…** opens Preferences. |

Source-specific controls disappear for Translation; translation-specific
controls disappear for Original. Notes remains available in either case.
Controls you explicitly hide stay hidden without changing their current
value, including an earlier session override. Use **Revert** to restore saved
defaults before hiding a control if that is the intended starting point.

**Preferences and Link Texts:** these share the settings but retain the
detailed **Layout**, **Source** and **Translation** sections. Preferences
starts Source and Translation open and offers full font editors. Link Texts
starts them folded and applies its choices to one linking pass. In those
sections each title's link switch is called **Link title to Sefaria**;
Preferences also offers the linked title's **Name the edition / translation**
choice.

**Transliteration details:** Style includes Simple English, Traditional,
Modern Israeli, Ashkenazi, Academic, ALA-LC, BGN/PCGN 2018 and IPA. A separate
column is headed by the Hebrew title in Latin letters (*Bereshit 1:1*,
Ashkenazi *Bereishis 1:1*) and linked like the Hebrew title. The text is read
from the fully vowelled source, even when Vowels is Off. Hebrew punctuation
Off also removes that punctuation from transliteration. The Name reads
*HaShem* unless changed in Transliteration Mapping; sentences and recognized
names start with capitals except in IPA.

**Keyboard:** Tab reaches the selected choice in a segmented control; arrows
select another. In Style, arrows move through choices and Enter or Space
selects one. Esc first closes the open menu; choosing None returns focus to
the Transliteration switch. Esc closes the panel when no inner menu is open.

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
**Preferences → Insertion → Layout → Citation style**.

With the cursor in a table cell, one language or the **Stacked** layout goes
inside the cell. **Hebrew right** and **Hebrew left** are tables themselves, so
they go directly below the table, and the sidebar says so. Headers, footers
and footnotes can't hold a source.

Fonts, sizes and colours come from the font buttons in **Preferences →
Insertion** (each opens its font's settings in place), and default to
**Match the document** — the font and size of the text where you insert.
Titles can be set to Heading 1–6 (Layout → **Title style**) so they appear in
the outline and table of contents. Sefaria's own bold and italics are kept;
change how they look under **Commentary → Advanced** in Insertion Defaults.

### Commentary and Notes

| Edition | Default | Combine | Drop |
| --- | --- | --- | --- |
| **William Davidson Edition - English**, Babylonian Talmud | Bold base translation, plain explanation | All words without source bold | Bold base translation |
| **The Rashi chumash by Rabbi Shraga Silverstein**, Torah; **The Rashi Ketuvim by Rabbi Shraga Silverstein**, Writings | Additions in square brackets | All words without those brackets | Balanced bracketed additions removed |
| Other editions | Words and source emphasis retained | Words and source emphasis retained | Words and source emphasis retained |

Retained words keep their italics. In Davidson, a line with no bold is
removed by Drop when another line has bold; a passage with no bold anywhere
is kept. Each Silverstein verse is processed separately; if its brackets are
incomplete or mismatched, that verse stays whole. Drop can leave an abrupt
sentence: it removes explanation but does not rewrite the edition's prose.

JPS's `[I give]` in Genesis 1:30 is supplied translation, so it stays. A bold
quotation inside a marked JPS footnote belongs to the note and follows Notes.
**Commentary: Drop + Notes: Separate** therefore keeps that note under the
passage. Notes applies to either language; transliteration reads the main
Hebrew without its marked notes.

Try `Genesis 1:1` with **THE JPS TANAKH: Gender-Sensitive Edition**, changing
Notes from Omit to Inline to Separate. Then choose Silverstein's Chumash and
compare the Commentary modes. Check the selected edition name after each
change and insert a sample to inspect final placement in Google Docs.

## Voices (source sheets)

Open the **Voices** tab and search source sheets by topic, title or text. The
sheets are grouped by topic (Torah Portions, Shabbat & Holidays, Prayer,
Tanakh, People…), and the **topic chips** over the list work like corpora in
Texts: click one, or a group's **❌**, to hide it for this search. **Preferences
→ Search → Voices Topics** saves the order of the groups and the topics to
leave out.

Pick a sheet, then under **What to insert** choose **Citation** (the
reference), **Text** (the sheet's text) or **Both** (the text, titled with a
link to the sheet), and optionally a **Transliteration**: each Hebrew passage
is then followed by its transliteration in parentheses; the English and
comments are not transliterated. The Voices transliteration is its own
setting, separate from Texts'. Click **Add Sheet**. Defaults live in
**Preferences → Insertion → Insertion Defaults → Voices**. The starting
choices are Citation and transliteration None.

## Lexicon (dictionary)

Open the **Lexicon** tab and type a Hebrew or Aramaic word, or an English one
to find the Hebrew words that mean it. The results are **words**: under
**Matches** those spelled as you typed, then **Related words** (the words it
is a form of or close to), or **Closest words** when nothing is spelled as
typed. Each shows its dictionaries and what they say it means.

- **Dictionary chips** over the list hide a dictionary's entries for this
  search, like corpora in Texts. **Preferences → Search → Lexicon
  Dictionaries** saves their order (Klein, BDB, BDB Aramaic, Jastrow, Strong's,
  Ben-Yehuda unless you change it) and the ones to leave out.
- **Pick a word** to list its entries, one per dictionary (and one per meaning
  where a dictionary has two words spelled alike). The first is selected;
  click others to add them, or **Select all**. One always stays selected.
- **What to insert:** **Full entry** (the default: the word, each dictionary's line, its
  numbered senses and notes), **Word + ref** (the word and the dictionaries'
  names) or **Definition** (the senses alone). The preview is an outline;
  **Show the whole entry** opens a long one, and **Copy** copies what will be
  inserted. Click **Add Entry**.

**📌** pins a word to the Session Library (words starred in earlier versions
are pins now). Recent lookups show as chips under the search box.

## Texts, Voices and Lexicon tabs

- **Typing** searches the tab you're in. **Enter** (or **🔍**) also searches
  the other tabs that are switched on, when the text suits them: a reference
  such as *Genesis 1:1* isn't looked up in the Lexicon. The number on each tab
  counts its results for what's in the search box.
- **Switching tabs never searches.** Each tab keeps its results, what you hid
  and what you had selected, and the search box keeps its text. A tab with no
  results for that text offers **Search Voices for “…”**.

## Session Library (📜)

Every source, sheet or word you insert is added (the most recent twelve, plus
up to thirty you pin). Open it with **📜** or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> +
<kbd>Shift</kbd> + <kbd>L</kbd>. Click an entry to reopen it in its own tab
(Texts, Voices or Lexicon), selected and ready to insert; **📌** pins it;
filter by Pinned, Recent or category, and sort; **Copy References** for a
plain-text list; **Clear Recent** (keeps pinned) or **Reset Session** (clears
everything). The Session Library is kept in your browser only.

## Quick Actions (🏃)

| Action | What it does |
| --- | --- |
| **Sel → ס** Insert Source from Selection | Select a reference typed in the document and run it. By default the selection is replaced by the source; turn off **Preferences → Insertion → Insert from Selection** to keep it and insert below. Link Texts' Insert follows the same setting. |
| **ה → ש** Transform Divine Names | Apply your divine-name replacements to text already in the document: every match in the body of the open tab, not only a selection (headers, footers, footnotes and other tabs are left alone). It asks first. |
| **🔗 → ס** Link Texts with Sefaria | Find citations in the document and link them to Sefaria. |
| **🎲** Surprise Me | Experimental; shown only when enabled in **Preferences → 🧪 Experimental**. Inserts a random set of sources on a word or theme, each with your saved **Preferences → Insertion** defaults (not this session's Insertion Options). |

**Preferences → Sidebar** can leave buttons out of the 🏃 panel; with all three
off, 🏃 goes too.

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
   Insertion Options settings, arranged as Layout and the detailed Source and
   Translation sections, plus **Replace a citation on its own line**.
   It reads *Your defaults* until you change
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

A citation Sefaria's linker can't match is looked up again the way the search
box does (consistent punctuation, Hebrew numerals without their marks,
abbreviations such as *Hil.* written out); a hit is linked like any other and
says which spelling found it. The rest are listed under **▸ Show … citations
that couldn't be matched**, each with the spellings searched, what Sefaria
answered and why none matched (a chapter the book doesn't have, an unknown
book name, *ibid.*). Fix the citation and run it again.

## Divine names

By default, inserted יהוה becomes יי. The rules are in **Preferences →
Insertion → Divine Name Mappings**: a master switch for replacement on
insertion, and a rule each for יהוה, יה, אלוהים and English *God*, each with a
choice of replacement or **Other**. **Transform Divine Names** applies the same
rules to text already in the document — the whole body of the open tab, not
only a selection — after asking.

## Preferences

Open with **⚙︎** or **Extensions → Sefaria for Google Docs → Preferences**. Preferences
are saved defaults and follow your Google account into every document. At the
top, **Interface** (Simple / Everything) switches at once, without Save, and
keeps any changes you haven't saved yet. Simple hides the Search, Linking,
Advanced and Experimental tabs; Everything shows them, and the Profiles column
beside the tabs.

### Starting choices

These are the defaults before setup or your own changes. Existing saved
choices are retained when the add-on updates.

| Setting | Starts on |
| --- | --- |
| Display and Arrangement | Hebrew and translation; Hebrew on the right |
| Line numbers / Line by line | On / Off |
| Citation credit / title links | On |
| Commentary / Notes | Default / Omit |
| Transliteration | Off |
| Vowels / Punctuation | On |
| Fonts and sizes | Match the document |
| Voices | Citation; transliteration None |
| Lexicon | Full entry |

The returning-user setup choice starts with the familiar bilingual layout
and Simple interface. It does not reset every setting. To keep an existing
profile intact, use **Keep my settings** when setup offers it.

| Tab | Contents |
| --- | --- |
| **Insertion** | Default Layout (the sidebar's pickers, plus the titles' **Title style** — e.g. Heading 2 — and **Citation style**, 8 pt italic in the font of the text above unless changed); Insertion Defaults for Texts (the card, plus the translation **Language**), Voices and Lexicon; Transliteration Mapping; Divine Name Mappings; Insert from Selection (also used by Link Texts' Insert). Every font button (each title, the Hebrew, transliteration and translation text, the citation) opens that font's full settings in place: font, size, style, colour, highlight and a preview, and for a title its **Hyperlink formatting override**. Under each **Link title to Sefaria**, while it is on, **Name the edition in the title** (Source) and **Name the translation in the title** (Translation) say whether a linked title names its edition. |
| **Search** | Text Search Results (group order and hidden groups); **Voices Topics** (the order of the topic groups, and the topics to leave out); **Lexicon Dictionaries** (the order a word's entries are listed in, and the dictionaries to leave out); Translation Languages; Advanced (Show unavailable translations). A chip in the sidebar brings a hidden topic or dictionary back for one search. |
| **Linking** | After linking; Insert text after linking; Document scanning. |
| **Sidebar** | What the sidebar shows (see below). |
| **Menu Bar** | Reorder, group, hide and divide menu items; **Move to Quick Actions ▸** / **◂ Move to main menu** move an item into the submenu or out. |
| **Advanced** | **Settings file**: **Export settings file** saves the settings shown (unsaved changes included) to a `.json` file, optionally named (*Grade 7 Chumash*); **Choose a settings file…** (or paste its text) shows what each part would change — Text and layout; Fonts, colours and titles; Search and linking; Menu and interface — and applies only the parts you tick. A file holds settings only, never searches, documents or account details. |
| **🧪 Experimental** | Optional in-progress features such as Surprise Me. |

Buttons: **Reset To Defaults** (every setting back to the original, and the
menu to the default for your interface; Simple or Everything stays),
**🔁 Refresh** (reload the sidebar from saved defaults, dropping its session
changes), **Save Defaults** and **Save & Close**. While one is working, a
spinner covers the dialog and says what is happening (*Saving preferences…*).

## What the sidebar shows

**Preferences → Sidebar**, in Simple and Everything, leaves out what you don't
use. Save applies it, and an open sidebar follows at once.

- **Search tabs:** the Voices and Lexicon tabs. Texts is always there. A tab
  switched off can still be opened from its menu item, and shows while you're
  in it.
- **Quick Actions:** which buttons the 🏃 panel offers. The menu is arranged
  separately, in Menu Bar.
- **Insertion Options** (Everything): which controls 📰 Insertion Options
  offers. Hiding a control keeps its current value, including a session
  override; use Revert first if the class should start from saved defaults.
  **Show all** brings them back.

Anything switched off is hidden, not removed, and your settings still apply.

## Profiles

A profile is a named set of how sources look, so you can keep one per class:
transliteration for beginners, say, and no vowels or punctuation with the
commentary dropped for adults. Profiles are in Everything, in a column beside
the Preferences tabs.

- The tabs always edit the profile in use (the filled dot). Click another to
  switch; if you have unsaved changes, Preferences asks first.
- **+ New profile** copies the one in use and switches to it; the first turns
  your settings into *My settings*. **Rename** and **Delete** act on the one
  in use. Up to ten.
- With two or more, the sidebar's **📰 Insertion Options** names the profile
  in use and has a **Profile** list. A switch, there or in Preferences, drops
  the session's Insertion Options changes.

A profile holds the *Text and layout* and *Fonts, colours and titles*
settings. The menu, Simple or Everything, what the sidebar shows, search and
linking stay the same in every profile.

## The menu

**Extensions → Sefaria for Google Docs** holds, by default: Texts, Voices, Lexicon,
Insert Source from Selection, and a Quick Actions submenu (Quick Actions
Sidebar, Transform Divine Names, Link Texts with Sefaria, Unlink Sources,
Gematriya Count), then Surprise Me (while it is switched on), Preferences and
Help & Support. Customize it in
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
- [Sefaria's Help Center](https://help.sefaria.org/hc/en-us/sections/20235182393244)
- [Privacy policy](https://www.sefaria.org/privacy-policy) · [Terms](https://www.sefaria.org/terms) · [Changelog](./CHANGELOG.md)

## Current limitations

- Hebrew misspelling tolerance is deferred; valid Hebrew-script references are
  supported, but typo correction is not.
- Linking is deliberately conservative: an ambiguous citation is asked about
  or skipped, never guessed.
