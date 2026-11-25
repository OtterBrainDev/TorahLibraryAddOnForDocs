# Changelog

All notable changes to Sefaria for Google Docs are documented here, newest first.

The version and the preference-schema number live in
[`docs/VERSION.json`](VERSION.json); the policy for numbering them is
[`docs/versioning.md`](versioning.md): every release is the next **2.0.X**
build until the owner asks for 2.1. New work goes under an `## Unreleased`
heading until the next build consolidates it under its own `## v2.0.X` heading.

## Unreleased

- **Simpler sidebar Insertion Options.** Display and Arrangement now have
  text labels. Line by line stays beside them for Both; Transliteration stays
  directly accessible when original text is included, with Style and Position
  shown as applicable. Remaining controls fold into Text and notes,
  References and numbering, and Fonts and appearance, with readable summaries.
  The existing shared controls, Simple/Everything modes and hidden-control
  choices remain. Collapsing a group never changes a setting or fetches text.
- **Safe session actions.** Revert, Save as defaults and profile switching
  wait for pending option saves. A failed save retries once, then pauses
  insertion with retry/Revert guidance so visible choices cannot silently
  insert with older settings. Saving defaults confirms the complete visible
  session first, including after its cache expires.
- **Correct lines across chapter gaps.** Line by line pairs Hebrew and
  translations by chapter and verse, leaving missing text blank. A missing
  early chapter fragment no longer shifts later translations or verse numbers,
  including when inserting several translations.
- **No empty language blocks.** An explicit missing Original/Translation
  output is stopped before a document or selection changes. Both still uses
  the language available. Translations emptied by Commentary/Notes are omitted
  with an explanation and remain available for different options.
- **Exact edition titles preserved.** Multiple-translation insertion keeps
  significant title whitespace in identity checks, results and pinned links.
- **Keyboard and documentation follow-through.** Shared radio controls and
  the transliteration menu support keyboard navigation and focus restoration;
  the Insertion Options dialog contains focus. Help/About, Preferences text
  and all tutorials describe the grouping and sidebar-session scope. Hidden
  controls keep their effective value; Revert restores saved defaults.
- **Bilingual edition identity and single-language recovery.** Some Hebrew
  and English editions share a title, including Rosenbaum/Silbermann's Rashi.
  Choosing one now retains the other language by edition identity. An
  unavailable edition in an unused language no longer blocks single-language
  output; changing Display refetches when needed, and Both revalidates its
  required editions before enabling Add Source.
- **Launch defaults completed — schema 33.** Voices starts on Citation with
  transliteration None, and Lexicon on Full entry. These were already the
  controls' fallbacks but were missing from the central defaults, so Reset,
  profiles and settings files could disagree. The migration fills missing
  values and repairs the literal `undefined` saved by affected older profile
  snapshots; valid choices stay. Settings imports reject that invalid value.
  Commentary remains Default and Notes remains Omit; other output defaults
  are unchanged.
- **Help and tutorials reconciled.** Help, Support, About, release notes,
  the user guide and all five walkthroughs explain edition persistence,
  partial-edition gaps, supported Commentary conventions and independent
  Notes modes. Preview limits and missing-edition recovery are explicit.
  The developer walkthrough now describes the v3 adapter and request costs.
  Tutorial scripts are prepared from source; live Google Docs checks and
  any updated screenshots or recordings are still to be completed.
- **Image descriptions preserved.** The shared source processor keeps an
  image's supplied alternative text in preview and insertion, including
  images inside marked notes. The note choice still applies. Actual images
  are not inserted or fetched.
- **Sefaria Texts v3.** All passage fetching now uses Sefaria's current text
  reader, preserving edition selection, credits and formatting metadata.
  Book references open a bounded section; malformed or mismatched replies
  cannot become inserted text or recovered citation links. Translation
  availability now checks every catalog language family correctly. Edition
  gaps remain gaps instead of being filled from a different edition, so the
  credit names the text actually used. Search, sheets, dictionaries and the
  citation linker keep their current supported endpoints. The API migration
  and separate commentary/notes follow-up are recorded in the
  [project handoff](sefaria-api-migration.md).
- **Selected editions survive Insertion Options changes.** Refreshing vowels,
  cantillation, punctuation or other options keeps the selected translation,
  Hebrew edition and ordered multiple translations. The preview and edition
  selectors agree; a stale response cannot enable insertion while a newer
  edition request is still loading.
- **Commentary follows the edition.** Default / Combine / Drop supports the
  William Davidson English Babylonian Talmud and Silverstein's Rashi Chumash
  and Rashi Ketuvim. In the Silverstein editions, Combine keeps the explanatory
  words without their square brackets; Drop removes balanced bracketed
  additions. Unknown editions keep their words and source emphasis, including
  supplied translation such as JPS's `[I give]`. A verse with malformed
  brackets stays whole.
- **Source Notes: Omit / Inline / Separate.** One setting in Layout applies
  to marked footnotes in Hebrew and translation, independently of Commentary.
  Separate collects labelled notes below the passage, or below its line in
  Line by line; it creates text sections, not native Google Docs footnotes.
  A shared processor handles semantic markers and nested note formatting for
  both preview and insertion. A bold quotation inside a note no longer
  decides which translation words survive.
- **Migration — schema 32.** `source_notes_mode` is seeded to `omit` when
  absent, preserving the old insertion behavior while making the preview
  agree. Existing values stay. Notes participates in saved defaults, session
  overrides, profiles, settings files and Link Texts' insertion options.
  Release 2.0.0 is unchanged; live Google Docs verification remains pending
  in checklist N and O.
- **Translation Versions selection.** A plain click now selects one translation;
  Ctrl/Cmd-click adds or removes individual translations, and Shift-click selects
  a visible range (Ctrl/Cmd+Shift extends it). The range anchor survives preview
  rebuilds. Filtering alone still does not change the selection; a plain click
  replaces even filtered-out selections. Lexicon entry selection is unchanged.

## v2.0.0 — First Marketplace release (release pending)

The first release published in the Google Workspace Marketplace, for people
who use *Sefaria for Google Docs* 1.0, and for new users.
It is the whole add-on as described in this file: every section below, back to
the 2026-04 cleanup pass, ships in 2.0.0. The next release is 2.0.1.

**Name and links.** The add-on is named *Sefaria for Google Docs* throughout:
the manifest, the setup dialog, Help and the release notes. Support goes to
Sefaria's Help Center, and the privacy and terms links to
`sefaria.org/privacy-policy` and `sefaria.org/terms`. The Help topic for
people who used 1.0 is *Coming from version 1.0*. Sections below were written
while the add-on was called Torah Library and keep that name. A settings file
is still marked `torah-library-settings`, so files exported earlier import;
its suggested file name is now `sefaria-google-docs-settings.json`.

**Preference schema 33.** A new install starts at schema 33, and so does
anyone coming from Sefaria for Google Docs, which stores no settings. A tester
upgrading from a development build is migrated on first open; the sections
below marked *Migration* say what each schema step changes.

### Highlights, compared with Sefaria for Google Docs 1.0

- **Find a text.** One sidebar with three tabs: **Texts**, **Voices** (Sefaria
  source sheets) and **Lexicon** (Sefaria's dictionaries). Results appear as
  you type, from an English or Hebrew reference, a title, a phrase or a
  sefaria.org link. Traditional citations resolve (*Hil. Shabbat 1:1*),
  near-misses are listed under *Close matches*, a search that finds nothing
  suggests titles, and corpora come in the order you choose. An on-screen
  Hebrew keyboard and keyboard shortcuts.
- **Preview, then insert.** Clicking a result shows exactly what will go in;
  **Add Source** (Ctrl / ⌘ + Enter) inserts it. Several translations at once,
  only translations with text for the passage are offered, and the filter
  finds a translation by its language's name (*French*, *français*, *צרפתית*). **Insert Source
  from Selection** turns a typed reference into the source. Inserts work
  inside a table cell.
- **Saved defaults.** Preferences → Insertion keeps how sources go in, in every
  document; **📰 Insertion Options** changes it for this session. A short
  first-run setup (with *I've used Sefaria for Google Docs* to start from that
  add-on's look), a **Simple** or **Everything** interface, profiles, and
  settings files to hand to a class.
- **Layout.** Hebrew on the right (as in 1.0), on the left, or stacked above
  the translation; **Line by line**; line numbers; the transliteration under
  the Hebrew or in its own column; titles as headings; a credit line naming
  each edition and its license.
- **Formatting.** Vowels Off / Tanakh / On; Cantillation Off / Tanakh / Torah;
  Punctuation for each language; transliteration in several styles (*HaShem*,
  capitalized names); Commentary Default / Combine / Drop for the Davidson
  English Babylonian Talmud and Silverstein's Rashi Chumash and Ketuvim;
  Notes Omit / Inline / Separate for marked footnotes; fonts that match the document; colour and
  highlight; separate source and translation titles; a citation style;
  formatting by translation language; cantillation marks a font lacks are
  borrowed from Noto Hebrew instead of showing as boxes.
- **Divine names.** Your spelling (יי, ה', יקוק, השם or your own, and *G-d*),
  applied as sources go in, keeping the Name's vowels and cantillation.
  **Transform Divine Names** asks first and says how many it replaced.
- **Link Texts with Sefaria.** Progress while it scans; a review dialog with
  Link and Insert columns; a question when a citation could mean more than one
  text; a *Not matched* list saying why; *Customize this insertion* for one
  batch. Only passages that look like citations are sent, unless you choose
  the whole document.
- **Voices and Lexicon.** Sheets grouped by topic, with transliteration for a
  sheet's Hebrew; a dictionary search that lists words, with entries from
  several dictionaries inserted together, in your order.
- **Session Library and Quick Actions.** What you've inserted, pins in every
  tab, *Copy References*; **Unlink Sources** and **Gematriya Count**; the menu
  and the sidebar arranged in Preferences → Menu Bar and → Sidebar.
- **Privacy.** No permission to see your email address or profile; no server,
  account or analytics of its own; a written privacy policy (`docs/PRIVACY.md`).

### Works differently from Sefaria for Google Docs 1.0

1. **Divine names are replaced as you insert.** Out of the box יהוה becomes יי
   in every new source. Preferences → Insertion → Divine Name Mappings.
2. **Clicking a result only previews it.** Nothing goes into the document until
   Add Source.
3. **Each source gets a credit line** naming its editions and their licenses.
   Turn *Citation* off in 📰 Insertion Options or Preferences → Insertion →
   Layout.
4. **Link Texts reviews its work**, and sends Sefaria only the passages that
   look like citations. Preferences → Linking.
5. **Insert Source from Selection replaces the selection** with the source,
   titled with your words. Preferences → Insertion → Insert from Selection.
6. **Fonts match the document** where you insert. Set your own with the font
   buttons in Preferences → Insertion.

The rest of this entry is the development record, newest first.

### The Name in the transliteration; ALA-LC and BGN/PCGN 2018 (schema 31)

#### Added

- **Write the Name as** (Preferences → Insertion → Transliteration Mapping):
  how the transliteration writes *יהוה* and every substitute for it, in every
  style: *HaShem* (the default, as before), *Hashem*, *Adonai*, *Adonoy*,
  *Ado-nai*, *G-d*, or the reader's own, up to 40 characters of plain text.
  A prefix stays in front (*laAdonai*). IPA reads *HaShem* and *Adonai*
  (and *Adonay*, *Adonoy*, *Adonoi*) as Hebrew, any other spelling as it is
  written. It is independent of Divine Name Mappings, which change the
  Hebrew. The insert, the sidebar preview, Link Texts and Voices read it.
- **ALA-LC (Library of Congress)** and **BGN/PCGN 2018 (Hebrew Academy)**,
  two new transliteration styles, from the tables attached to the request
  (the Library of Congress Hebrew and Yiddish table, and the BGN/PCGN 2018
  agreement based on the Academy of the Hebrew Language's 2006/2011
  systems). ALA-LC: its letters (ʼ ṿ ḥ ṭ ḳ ś ʻ), an initial or vowel-marking
  alef disregarded, the prime (*hisʹhid*), and the article, the conjunction
  and the prepositions that take the article hyphenated (*ha-milon
  he-ḥadash*, *ṿe-ha-arets*, *u-*, *la-*, *mi-*, *she-*); doubling follows
  Double dagesh chazak. BGN/PCGN: ’ ‘ ẖ q, *v* for every vav, no final
  silent he (*Tora*), a dagesh chazak always doubled but never *sh* or *ts*,
  a name after a prefix capitalized and not doubled (*miMitsrayim*). Each is
  tested against the examples its standard prints (*‘Akko*, *Karkom*,
  *Ge’ullim*, *Be’er Sheva‘*, *Roqeaẖ*, *Ne’dar*, *Ela*; *ha-Milon
  he-ḥadash*, *hisʹhid*).
- **Help → Transliteration styles → Academic standards**: what each standard
  is for, what the style does and what it leaves to the author (ALA-LC's
  *be-*/*le-*, dictionary vowels for unpointed text; BGN's dictionary-based
  sh'va), and IJMES, which transliterates Hebrew with the Library of
  Congress chart and adds editorial rules (Merriam-Webster spellings, no
  diacritics in names and titles).

#### Changed

- An aleph with a sh'va is a consonant, not a silent letter (*Ne’dar*).
- The style samples keep the maqaf as the Hebrew mark, so a prefix's hyphen
  (ALA-LC's *ha-*) is never taken for one when the Hebrew's punctuation is
  off.

#### Migration

- **Schema 31** adds `transliteration_divine_name`, set to `"HaShem"` for
  everyone who has no value, which is what every transliteration has written.
  A stored value is never overwritten. In the settings file's *Text and
  layout* part and in profiles.

### Transliteration read the way Hebrew is read; Double dagesh chazak; siddur styles

#### Fixed

- **The transliteration wrote every letter and sign on its own**, so most
  pointed words came out wrong: a shuruk was a "v" (*'Eloheynv*, *Barvkhe*,
  *Rvkha*), a holam's vav a "v" too (*Tvov*, *Yvom*), a silent yod, aleph
  or sh'va was written (*Bere'shiyt*, *Yisera'el*, *Melekhe*), every kamatz
  was "a" (*Kal*, *Khakhemah*), and a patach under a final ח came after it.
  Over a sample of Sefaria's Tanakh and siddur, about two words in three
  differed from a careful reading. Each pointed word is now read as a whole
  (`readWord_` in `transliteration.gs`): vowel letters (shuruk, holam male,
  hiriq/tsere/segol + yod, a final he, an aleph with no vowel), spoken and
  silent sh'va, kamatz katan (marked U+05C7 in Sefaria's Tanakh, which is
  trusted; elsewhere by its closed unstressed syllable, *kol*, *chokhmah*),
  dagesh chazak and lene, and the furtive patach (*ruach*). A shin or sin dot
  that stands for a holam is read (*משֶׁה* → *Mosheh*). The cantillation tells
  the reader the stress before it is dropped. Text without vowels is read
  letter by letter as before.
- **An aleph or ayin at the start of a word is no longer an apostrophe** in
  Simple English, Modern Israeli and Ashkenazi (*Ekhad*, *Rabbi Akiva*);
  Traditional keeps *ʿ* for ayin, Academic both signs, IPA *ʔ*. A capital
  now follows the *ʾ* / *ʿ* sign (*ʿOlam*).
- The style samples in Preferences and on the composition card were written
  by hand and showed spellings the engine never wrote (*ha-sēfer*); they are
  now the engine's own output, and a test keeps them so.

#### Added

- **Double dagesh chazak** (Preferences → Insertion → Transliteration
  Mapping): *Shabbat*, *tefillah*, or *Shabat*, *tefilah*. It is the stored
  `transliteration_biblical_dagesh_mode` (`"none"` / `"forte"`), which had no
  control; it now applies to every text, not only the Tanakh, and the sidebar
  preview and Voices read it too. Default off, as before: no migration, no
  new key. Two-letter sounds (sh, ts, kh) are written once.
- **Vowel signs in Transliteration Mapping**: twelve vowel signs beside the
  letters, each changed wherever it is pronounced (a sh'va only where it is
  spoken, so *'* gives *b'mitzvotav*; tsere with its yod; holam with its vav;
  kubutz with shuruk). A letter that changes with a dagesh now changes only
  without it: כ → *ch* keeps כּ *k*.
- **Help → Transliteration styles**: how the reading works, each style on one
  blessing, and how to come close to Mishkan T'filah, Siddur Lev Shalem,
  Koren and ArtScroll with a style and Transliteration Mapping (Hadar and
  Pardes publish no siddur transliteration we could find).
- `test/tests/transliteration-reading.test.js`. No new preference, RPC or
  OAuth scope; `transliteration_is_biblical_hebrew` now means "trust the
  Tanakh's kamatz katan marks".

### Help → About: what's new in 2.0

- **About → New in 2.0 lists everything new or improved** compared with
  Sefaria for Google Docs 1.0: 70 items in eleven folded groups (Finding a
  text, Previewing and inserting, Layout, Hebrew and translation formatting,
  Divine names, Link Texts, Voices, Lexicon, Session Library and Quick
  Actions, Your settings, Help and privacy), each tagged *New* or *Improved*
  with where to find it. It points to *Coming from Sefaria for Google Docs*
  for where that add-on's commands went and what works differently. It
  replaces the nine-line summary.
- `test/ui/help-links.test.js`: every link inside Help lands on a topic that
  exists, and every About item has its tag and its place. No new preference,
  RPC or OAuth scope.

### Keeping version numbers in sync

No code, preference or migration change.

- **`CLAUDE.md` / `AGENTS.md`: *Versions: keep them in sync*.** The 2.0.X
  rule, every place the version is written and what keeps each in step, the
  release-commit rule, the schema's own clock, and a `git grep` for
  stragglers. `docs/versioning.md` §3–4 say the same.
- **`docs/VERSION.json` lists the docs that name the version** (`docs`): the
  version under demo or test in the walkthroughs, the live test checklist
  they and the store listing point to, and the release commands.
  `version-manifest.test.js` checks each like a surface: in its file, with the
  full version (or, marked `line`, the line as About shows it), and with the
  current schema where it names one. The stress test's reporting line names
  *2.0.0, schema 30*.
- **`AGENTS.md` is `CLAUDE.md` again.** It had drifted (it still expected 248
  passing tests and lacked rules added since); it is now a copy, and
  `test/ui/agent-guides.test.js` fails if the two differ. The developer
  walkthrough points at `CLAUDE.md` for the passing count instead of
  repeating it.

### Help and walkthroughs: caught up with the recent changes

No code, preference or migration change. Help, the Google Docs walkthrough, the
five live walkthroughs and the README described the sidebar as it was before
the one search workflow, the Lexicon's words, profiles and Preferences →
Sidebar. Now:

- **Switching tabs.** Everywhere that said switching Texts / Voices / Lexicon
  "runs the same search again" now says it never searches, that typing
  searches the tab in view and Enter the others too. Help → Troubleshooting
  has *I switched tabs and it didn't search*.
- **Several translations** are picked with a click each, not
  <kbd>Ctrl</kbd>/<kbd>⌘</kbd>-click; a translation with no text for the
  passage is left out of the list (greyed out only with *Show unavailable
  translations*), not "greyed out and skipped"; the filter box finds a
  language by its name. Help → Troubleshooting has *A translation I want isn't
  in the Versions list*.
- **Lexicon**: words, Matches / Related words, dictionary chips, picking
  several entries, Add Entry and Copy; ⭐ *Starred entries* is gone (stars are
  pins). **Voices**: topic groups and chips, the transliteration in
  parentheses. **Session Library**: up to thirty pins, sheets and words too,
  each reopening in its own tab.
- **Simple mode** keeps the Texts / Voices / Lexicon tabs and hides 🧪; a
  missing Voices or Lexicon tab is Preferences → Sidebar, not Simple (walkthrough
  5's table said to switch to Everything). *Show advanced settings*, retired,
  is gone from the Google Docs walkthrough.
- **New sections** in the Google Docs walkthrough: *Texts, Voices and Lexicon
  tabs*, *What the sidebar shows*, *Profiles*, the Preferences Sidebar and
  Advanced tabs, Voices Topics and Lexicon Dictionaries, Link Texts' list of
  citations that couldn't be matched, Line by line for Stacked and the
  transliteration's Position. Walkthrough 3 tours the Search and Sidebar tabs,
  profiles and settings files; walkthrough 4 mentions profiles.
- **Surprise Me** is described as inserting with the saved Insertion defaults,
  and is listed in the menu while it is switched on.
- **About → Your privacy** says the Session Library keeps your pins (there are
  no starred Lexicon entries) and that profiles are stored with your
  preferences.
- **Stress test**: stale rows fixed (4.1, 4.3, 9.5, 9.6, 10.9) and rows added
  for Line numbers off (3.1a), the language filter (4.8), Lexicon entries and
  dictionaries (9.6a–b), Voices topics (9.7), the tab workflow and pins
  (9.8–9.8b), Surprise Me's defaults (10.9f), Preferences → Sidebar (10.10)
  and profiles (10.11). The developer walkthrough's schema (30) and include
  count are current, and it covers Preferences → Sidebar, settings files,
  profiles and `search-tabs`.

### Translation versions: find a language by its name

#### Changed

- **The filter box above *Translation versions* finds a language by its
  name**, not only by its two-letter code. *French*, *français*, *צרפתית*,
  *Französisch* and *французский* all list the French translations: each
  language in Preferences → Search → Translation Languages is known by its
  name in English, in itself and in each of the others (from CLDR, the
  Unicode locale data browsers use), plus a few other names in use (*Farsi*,
  *Judezmo*, *אידיש*). The first letters are enough (*fre*); case, accents,
  vowel points and apostrophes don't matter (*francais*, *יידיש*, *צ'כית*). A
  code typed exactly is that language alone, as before (*es* doesn't add
  Esperanto), and a version's title still matches as it did. Client-side
  only: no new preference, no request to Sefaria
  (`TRANSLATION_LANGUAGE_CATALOG` in `shared/ui/state`,
  `filterTranslationItems` in `sidebar/js/preview-core`).

### Line numbers: off is respected in the sidebar and Surprise Me

- **Fix.** With *Line numbers* off (📰 Insertion Options, or Preferences →
  Insertion → Layout), Add Source still numbered a passage with verses, a
  Tanakh verse range such as Genesis 1:1-3, while the card showed the switch
  off. Previewing a passage reset the choice: on for any verse range, off for
  a single verse. The preview no longer touches it; a text with no verses to
  number is still inserted without them. Insert from Selection and Link Texts
  were not affected. No preference or default changes.
- **Surprise Me follows your Insertion defaults.** It inserted every source
  the same way, whatever Preferences said: both languages side by side, lines
  numbered, titles not linked, no credit, citation or transliteration. Each
  source is now inserted the way Insert from Selection inserts one: with your
  output, arrangement, Line numbers, linked titles, credits, citation,
  transliteration and Commentary. With the default settings that means
  linked titles and the edition credited, where Surprise Me had neither.
  From the sidebar's 🧪 tab it uses the saved settings, not changes made only
  for this session in the Texts tab's Insertion Options.

### Line by line for Stacked; the transliteration in a column of its own (schema 30)

**Migration (schema 29 → 30): `transliteration_position` is set to "below",
where the transliteration has always gone, so no upgrader's side-by-side
insert changes. Line by line (`bilingual_aligned_rows`) is not migrated, and
now also applies to Stacked: anyone who has it on and inserts Stacked gets
each line followed by its translation instead of one block per language.
Switch it off in 📰 Insertion Options (or Preferences → Insertion → Layout)
for the blocks.** New preference, in the settings file's *Text and layout*
part and in profiles: `transliteration_position` (`below` / `left` /
`right`, default `below`).

- **Line by line, Stacked.** With Hebrew and translation Stacked, *Line by
  line* puts the two titles at the top, then each line, its transliteration
  and its translation, one after another down the page. With several
  translations picked, each Hebrew line is followed by that line of each
  translation, in the order picked, under one title each. A source with no
  lines to pair keeps the blocks. The switch now shows in every arrangement
  of both languages (it showed only side by side).
- **The transliteration's Position**, side by side. Under *Transliteration*,
  *Position* puts it **Below** the Hebrew in its column (as before), or in a
  column of its own **Left** or **Right** of the Hebrew: a three-column
  table. With *Line by line*, each row's transliteration sits beside its own
  line. Stacked always puts it under the Hebrew, so *Position* shows side by
  side only (in Preferences, always, as the default). Link Texts' *Customize
  this insertion* offers it too.
- **The transliteration column's title** is the Hebrew title in Latin
  letters, linked (in the linked style) when the Hebrew title is, with the
  chapter and verse in digits (`server/transliterated-title.gs`):
  - **Sefaria's own Latin name for the Hebrew title** where it has one:
    "Bereshit 1:1-2", "Shmuel Aleph 1:1", "Ovadiah 1:1", "Berakhot 2a:1",
    "Mishneh Torah, Hilchot Shabbos 1:1". Sefaria lists a work's Latin titles
    without saying which is which ("Gen.", "Genesis", "Bereshit"), so the one
    chosen is the one that spells the Hebrew title's consonants, read as the
    transliteration's style reads them (ש as *sh*, ח as *ch*/*kh*, ת as *s*
    in Ashkenazi: "Bereishis", "Berachos"). For a book of the Tanakh,
    Sefaria's main title is its English name, so its other names come first;
    abbreviations and marked-up names are never used. Every book of the
    Tanakh has one.
  - Otherwise, the Hebrew title transliterated in the text's style, read in
    a pointed spelling (Sefaria's, or a built-in list of the Tanakh's book
    names): Sefaria's Hebrew titles have no vowels, and bare consonants read
    badly (`בראשית א׳:א׳-ב׳` read "Vrʾshyt ʾ:ʾ-v").
  - Otherwise, Sefaria's Latin reference ("Rashi on Genesis 1:1:1").
- **Fixed: Stacked with several translations dropped the transliteration.**
  It now goes under the Hebrew, before the translations, as with one
  translation; with *Line by line*, under each Hebrew line.
- **The Arrangement icons sketch the result**: the transliteration as a
  strip under the Hebrew or a column of its own, and with *Line by line*, the
  lines (rows across the columns side by side; two lines in Stacked).
- No new RPC and no new OAuth scope.

### Profiles; Preferences → Sidebar; Voices and Lexicon in Simple mode (schema 29)

**Migration (schema 28 → 29): every existing user, Simple or Everything, keeps
every sidebar tab, Quick Actions button and Insertion Options control, and has
no profile until they make one, so nothing an upgrader sees changes except
that Simple mode gains the Voices and Lexicon tabs.** New preferences, all in
the settings file's *Menu and interface* part: `show_voices_tab` and
`show_lexicon_tab` (default `true`), `sidebar_quick_actions_hidden` and
`sidebar_options_hidden` (default `[]`, nothing hidden). New stored state, not
a setting: `settings_profiles` (default `""`, no profiles) and one
`settings_profile_<id>` per profile not in use.

- **Profiles (Everything).** A column beside the Preferences tabs keeps named
  sets of how sources look (the settings file's *Text and layout* and *Fonts,
  colours and titles*), so a teacher can keep transliteration on for a
  primary class and vowels, punctuation and commentary off for adults, and
  switch in a click. The tabs edit the profile in use; clicking another
  switches to it, asking first about unsaved changes. *+ New profile* copies
  the one in use (the first turns your settings into *My settings*); *Rename*
  and *Delete* act on the one in use; up to ten. In the sidebar, with two or
  more, *📰 Insertion Options* names the profile in use and has a *Profile*
  list; a switch drops the session's Insertion Options changes. The menu, the
  interface, what the sidebar shows, search and linking stay the same in
  every profile. A profile kept aside is migrated when it comes back, like
  stored preferences. Everything's Preferences is wider (860 px) for the
  column.
- **Preferences → Sidebar**, a new tab in both interfaces, saved with Save:
  switches for the **Voices** and **Lexicon** tabs, for each **Quick Actions**
  button (with all three off, 🏃 goes and the row closes up), and, in
  Everything, for each **Insertion Options** control (Display, Arrangement,
  Citation, Line by line, Line numbers; the source's link, vowels,
  cantillation, punctuation, transliteration; the translation's link,
  punctuation, commentary; title and text fonts). A hidden control uses the
  saved default. Everything is hidden, never removed: a menu item still
  opens a switched-off tab (which shows while it is open), the sidebar never
  reopens on one by itself, and a switched-off tab takes its *Insertion
  Defaults* sub-tab with it. The menu is unchanged: Menu Bar arranges it.
- **The Texts / Voices / Lexicon tabs show in Simple mode.** Simple now hides
  only the result sort, Restore Corpus and 🧪 in the sidebar.
- Enter's background search of the other tabs leaves out a tab that is
  switched off: a request nobody could see.
- **Fixed:** in Preferences, scrolled content painted over the pinned tab
  bar (an open section's layer was above it); the tabs now stay on top.
- Help has two new topics, *What the sidebar shows* and *Profiles*; the
  setup screen's *Everything* card, the walkthrough and the design doc say so.
- New RPCs (`docs/rpc-surface.json`): `getSettingsProfiles`,
  `createSettingsProfile`, `switchSettingsProfile`, `renameSettingsProfile`,
  `deleteSettingsProfile`. No new OAuth scope.

### One search for the three tabs; Voices topics; pins in every tab

**Two new preferences, schema 28 (migration):** `voices_topic_order` and
`voices_topic_excluded`, both set to `[]` for everyone upgrading: the built-in
topic order, no topic hidden, so every sheet you saw before is still listed.
**Starred Lexicon words become pins** the first time the sidebar opens (see
below); the *⭐ Starred words* list is gone.

- **Switching tabs never searches.** Each tab keeps its own search: its
  results, what you hid, and what you had selected (a text with its preview
  and versions, a sheet, a word with the entries you picked). The search box
  keeps its text. Switching used to search the box again in the new tab and
  lose the selection, and a Texts reference was looked up in the Lexicon
  ("Genesis 1:1").
- **Enter searches all three tabs.** Typing searches the tab you're in.
  Enter, or the search button, also searches the other two in the background
  when the text suits them (a reference or a Sefaria link isn't looked up in
  the Lexicon, a link isn't searched in Voices), so their results are there
  when you switch. Each tab's number counts its results for what's in the box.
  A tab with none for that text offers **Search Voices for “…”**.
- **Voices topics are filtered like corpora.** Sheets are grouped by topic:
  Torah Portions, Shabbat & Holidays, Prayer, Life Cycle, Halakhah, Tanakh,
  Talmud & Midrash, People, Jewish Thought, Values & Ethics, Israel & History,
  Other. A sheet goes under the first of its Sefaria topics that fits one (the
  most specific match decides: *Laws of Shabbat* is Halakhah), or by its title
  if it has none. Each group has its ❌, and a chip per topic over the list
  hides or shows it for this search. *Preferences → Search → Voices Topics*
  saves the order of the groups and the topics to leave out; settings files
  carry both (Search and linking). A sheet's row now shows its author and its
  own topics instead of "Source Sheets • EN, HE".
- **Pins in every tab.** Sheets and words have the 📌 texts have. The Session
  Library files them under *Source Sheets* and *Dictionary* (an inserted sheet
  was filed under "voices", a pinned one under "Source Sheets"; old entries
  are moved), and keeps a sheet's title whole (it was cut at its first comma).
  Pins hold up to thirty (was twelve).
- **Fixed: opening a sheet or a word from the Session Library.** Clicking an
  entry (in the Library window, its sidebar list, or *Recent*) searched its
  reference in whatever tab was open and looked for it 250 ms later: a sheet
  searched "sheet:123" in Texts and found nothing, and a slow answer left
  nothing selected. Now its own tab opens, with the search that found it, and
  the entry is selected when the answer comes. A pinned sheet that search no
  longer lists is shown from the pin.
- **Starred words are pins.** Your ⭐ starred Lexicon words are added to the
  Session Library's pins, after the pins you have, once; each opens in the
  Lexicon as a pin does.
- *Recent* (in Texts, before a search) lists Texts' own entries, with their
  corpus.
- The result sort (Rel. ▾) applies to Texts, the only tab that shows it; its
  choice also re-sorted Voices' sheets and the Lexicon's words.
- Fixed: the pause after pressing Enter searched the same text a second time.
- Voices' *Prev* / *Next* mark the sheet they open in the list.

### Lexicon: words, and several dictionaries' entries at once

**Two new preferences, schema 27 (migration):** `lexicon_dictionary_order`
and `lexicon_dictionary_excluded`, both set to `[]` for everyone upgrading:
the built-in dictionary order, no dictionary hidden, so nobody loses a
dictionary they had. **What Add Entry inserts looks different** (see
*Inserted entries keep their structure*).

- **A Lexicon search lists words, not entries.** Sefaria answers a lookup
  with every dictionary entry the word could belong to, and the sidebar listed
  each as a result of its own (for שם, 25 rows, ten of them שֵׁם), so
  taking Klein's and BDB's entries meant picking, inserting, going back and
  picking again. Now each headword is one row, with its dictionaries and what
  each says it means: the words spelled as typed under **Matches**, then the
  words it is a form of or close to under **Related words** (for שם: שָׁם,
  שֵׁם and שֻׁם match; שׂוּם *put* and Klein's שׁום *assess* are related), or
  **Closest words** when nothing is spelled as typed.
- **Dictionaries are filtered like corpora.** A chip for each dictionary that
  answered, with its count (for שם: Klein 5, BDB 6, BDB Aramaic 2, Jastrow 4,
  Strong's 6, Ben-Yehuda 2), sits over the word list, as the
  corpora do in Texts. A click hides that dictionary's entries from every
  word for this search (a word left with none drops out) and another click
  brings them back; the count says how many are shown. A new search shows
  every dictionary again.
- **Saved dictionary order and hidden dictionaries.** *Preferences → Search →
  Lexicon Dictionaries* lists them like the corpora above it: drag or use the
  arrows to set the order a word's entries are listed in (built in: Klein,
  BDB, BDB Aramaic, Jastrow, Strong's, Ben-Yehuda; the first is the one
  picked when a word opens), and hide the ones you don't use. A hidden
  dictionary's chip stays over the results, crossed out, and shows it for
  that search; settings files carry both choices (Search and linking).
- **Fixed: an English word never found anything.** The lookup in the
  dictionaries' definitions was filtered by their titles ("Klein Dictionary",
  "Jastrow"), and Sefaria matches a filter against the start of a category
  path ("Reference/Dictionary/…"), so nothing ever matched. It now searches
  Reference/Dictionary (all of Reference, keeping only the dictionaries, if
  that finds nothing), lists only the headwords it found, and says the lookup
  is unavailable when Sefaria doesn't answer instead of "no entries".
- **A word's entries are picked like translations.** Picking a word lists its
  entries (Klein I, BDB I, BDB II, Jastrow I, Strong's 8034, Ben-Yehuda…) with
  each one's part of speech and meaning (Ben-Yehuda's in Hebrew, right to
  left; its footnotes are left out). The first is selected; a click adds or removes one; *Select all*
  takes the rest; one always stays selected. Add Entry inserts them in the
  order picked, which the list and the preview number.
- **The preview is an outline.** Each picked entry is a card: dictionary, part
  of speech and headword on top; the senses with the dictionary's own numbers
  (1., a.) and stems (Qal, Hiph.), not a running count to 27; each cut to two
  lines, with *Show the whole entry* for a long one; notes and derivatives
  folded away; the dictionary's credit at the foot. *Copy* copies what Add
  Entry inserts.
- **Inserted entries keep their structure.** *Full entry* is the word as a
  heading, once, then for each entry a line naming the dictionary (and part
  of speech), each sense as a paragraph of its own with sub-senses indented,
  and Klein's notes and derivatives. Bold, italics and superscript are kept.
  Before, an entry went in as one paragraph of plain text, cut at 2,000
  characters. *Definition* leaves out the word and the dictionary lines;
  *Word + ref* is the word and the dictionaries' names. The translation's
  *Commentary* setting never applies to a definition.
- An inserted word goes into the Session Library as the word and its
  dictionaries; clicking it opens it in the Lexicon (see *Pins in every tab*
  above; stars became pins).

### Settings files; one Interface switch; Voices transliteration; Surprise Me

No new preference and no migration: no stored value changes meaning.

- **"Bold & italics" is now "Commentary": Default / Combine / Drop.** The
  Translation section's row says what it is for: the commentary Sefaria sets
  in plain text around its bold direct translation (the Steinsaltz Talmud).
  **Default** (was *Keep*) inserts the translation as Sefaria marks it.
  **Combine** (was *Drop*) drops the bold, so the translation and its
  commentary look the same. **Drop** (was *Bold only*) leaves the commentary
  out and keeps the bold translation. **Note: "Drop" now means what "Bold
  only" meant.** Stored choices are unchanged (`keep`, `discard`, `only`).
  "Corpuses" is now "corpora" throughout.
- **Setup: "I've used Sefaria for Google Docs".** Screen 1's last answer was
  "I've used Torah Library before — Keep my settings as they are", which
  nobody installing can truthfully pick. It is replaced by an answer for
  people coming from Sefaria for Google Docs, which starts screens 2 and 3 on
  that add-on's look (both languages, Hebrew on the right, Simple) and
  explains under *God's name* that it is now replaced as sources go in. "Keep
  my settings" is kept for people who have settings of their own (setup run
  before, or a stored setting changed): it appears for them, so a later
  upgrade that shows setup again offers it. No new preference.
- **Help: *Coming from Sefaria for Google Docs*.** A new Help topic (in the
  navigation and on Quick start) for people arriving from Sefaria's own
  add-on: where *Add Sources with Sefaria*, *Transform Divine Names* and *Link
  Texts with Sefaria* went, what stays the same, what's new, and what works
  differently (divine names replaced on insert, the credit line, reviewed
  linking, fewer permissions). Walkthrough 4, the README and the stress test's
  account C now describe that add-on; they described an older one, and said
  settings from it were kept, which can't happen: it stores none.
- **Italics is never treated as commentary, and is always kept.** Sefaria
  italicizes foreign and transliterated words (*Shema*, *teruma*) in the
  translation and its commentary alike, so only bold decides what is
  commentary, and italics stays on whatever text is inserted, in all three
  modes. **Combine changes for anyone who chose it (as *Drop*): it used to
  remove the italics too; it now keeps them.** Default and Drop insert what
  they did. The sidebar preview shows the same.

- **Settings file (Preferences → Advanced, a new tab).** *Export settings
  file* saves the settings shown in Preferences (unsaved changes included) to
  a `.json` file, optionally named ("Grade 7 Chumash"); *Import* reads one,
  shows what each part would change (Text and layout; Fonts, colours and
  titles; Search and linking; Menu and interface) and applies only the parts
  you tick. A teacher can give a class the same vowels, layout and
  transliteration; an organization can hand out its fonts, colours and title
  styles. A file holds settings only, never searches, documents or account
  details; an import writes only real settings with valid values and skips
  the rest. Where a browser blocks the download, the text can be copied, and
  pasted into Import. Everything happens in the browser: no new permission.
- **One Interface switch.** *Show advanced settings* did in Preferences
  exactly what switching to *Everything* does, beside it, and switching
  looked as if it might reset settings or keep two sets. It is gone:
  *Interface: Simple / Everything* is the one switch. Switching never changes
  a setting, keeps values you have not saved yet (and unsaved Menu Bar
  edits), and reaches an open sidebar at once, so the sidebar no longer has
  to be refreshed (which cleared its Insertion Options for the session).
  *Reset To Defaults* keeps the interface and resets the menu to the one for
  it: in Simple mode it used to put the full menu under the Simple interface
  and keep a second, older menu for leaving Simple.
- **Name the edition, visible.** *Name the edition in the title* (Source) and
  *Name the translation in the title* (Translation) are rows under each *Link
  title to Sefaria* in Preferences → Insertion, shown while that title is
  linked. They were inside each title's font editor, behind the *Title font*
  button.
- **Cantillation without vowels shows in the preview.** With Vowels off, the
  Insertion card's sample showed bare letters whatever Cantillation said, so
  the two looked tied; the insert always kept them apart. The sample now
  shows each combination.
- **Voices transliteration.** Choosing a transliteration in the Voices tab
  silently changed the Texts transliteration instead (the two menus shared
  a class the composition card listened to) and left the Voices button on
  *None*. It now selects, says what it will insert, and shows a sample. In
  the inserted sheet each Hebrew passage is followed by its transliteration
  in parentheses, and only Hebrew is transliterated (the Hebrew of sources
  and of the author's own Hebrew text; never the English or comments).
  Choosing one no longer resets *What to insert* to its saved default.
- **Menu Bar: moving items is labelled.** Each item has *Move to Quick
  Actions ▸* or *◂ Move to main menu* instead of a bare arrow beside ↑ ↓; an
  item moved out lands just below Quick Actions, and moving one into a hidden
  or empty Quick Actions shows the submenu again.
- **Surprise Me is one form.** The sidebar's Experimental card and the
  Surprise Me dialog (Quick Actions 🎲, the menu) had drifted apart: a topic
  hint, 3 sources and five fixed corpora in one; a search term, 5 sources and
  a choice of fourteen corpora in the other. Both now show the same form,
  and report what the server actually inserted.

- The English divine-name replacement now also catches "GOD" (keyed on the capital G; lowercase "god"/"gods" are untouched), on insert and in Transform Divine Names. An all-caps match gets an all-caps substitute (G-D). No new preference.

> **Preference migration (schemas 21 and 22). No new preference.** Borrowing
> the Hebrew marks a font has no glyph for is always on, for new and existing
> users alike; there is no setting. It changes only those marks, which until
> now showed as empty boxes or in whatever font the reader's computer fell
> back to. Help → Layout Settings → *Fonts and cantillation marks* explains it.
> Schema 21 added a `hebrew_mark_fallback` switch during development; schema
> 22 retires it before release and deletes any stored value (test builds
> only), so a `false` saved there no longer turns the borrowing off.

> **Preference migration (schema 23). Eleven new preferences, none of which
> changes an existing user's inserts.** The source (Hebrew) title now has its
> own link switch (`insert_hebrew_sefaria_link_default`) and its own title
> styles (`hebrew_title_*` for the plain title, `hebrew_link_*` for the linked
> one). Schema 23 starts each one as a copy of the setting that, until now,
> governed both titles (`insert_sefaria_link_default`, `source_title_*`,
> `sefaria_link_*`), which from here on are the translation title's alone. A
> setting the user never stored takes the default, which equals the
> translation title's.

> **Preference migration (schema 24). Two new preferences, and one stored
> value rewritten; no existing user's inserts change.** Each title now keeps
> its own font whether or not it is linked; `sefaria_link_format_override`
> and `hebrew_link_format_override` ("Hyperlink formatting override") give a
> linked title its linked style instead. Schema 24 turns both **on** for
> everyone, which is how linked titles have always looked. Cantillation gains
> a real *Torah only* choice (`teamim_filter = "torah"`); a `"torah"` stored
> by an earlier version always meant *Tanakh only*, so schema 24 rewrites it
> to `"tanakh"`.

> **Preference migration (schema 25). Five new preferences; no existing
> user's inserts change.** The citation under an inserted source has its own
> style (`citation_font`, `citation_font_size`, `citation_font_style`,
> `citation_font_color`, `citation_font_background`). Schema 25 sets each to
> the citation's fixed look until now: 8 pt italic, in the font of the text
> above it.

### Preferences: fonts are set where they apply; no Fonts tab

No new preference, no migration; every stored setting is read and saved as
before. Once the composition card had font buttons, the Fonts tab repeated the
Insertion tab, and the buttons' small font-and-size panel sent you to the
Fonts tab for anything more. Now every font has one place, beside what it
styles:

- In **Preferences → Insertion**, each font button (**Title font** and **Text
  font** in Source and Translation, and the transliteration's new **Font**
  under its Style) opens that font's full settings in place: font, size,
  bold / italic / underline, text colour, highlight and a preview; a title's
  also has its **Hyperlink formatting override**, and the translation's its
  formatting for specific languages.
- **Layout** gains **Title style** (Normal text or Heading 1–6) and **Citation
  style** (a button that opens the citation's settings the same way).
- The translation's preferred **Language** is a row in Insertion Defaults →
  Translation; how kept bold and italics look is under **Bold & italics →
  Advanced**.
- The Fonts tab's second copies of the transliteration scheme and of Keep /
  Discard / Bold only are gone: the card's **Style** and **Bold & italics**
  are those settings.
- Preferences opens on the Insertion tab. The sidebar and Link Texts keep the
  compact font panel.

> **Preference migration (schema 26). Two new preferences; no existing
> user's inserts change.** Whether a linked title names its edition is now a
> setting, one per title: `sefaria_link_edition_label` (translation title)
> and `hebrew_link_edition_label` (source title). Schema 26 turns both **on**
> for everyone, which is how linked titles have always read.

### Linked titles: "Name the edition" (9 November 2026)

#### Added

- **A linked title can be just the reference.** A title linked to Sefaria
  has always added the edition after it — *Genesis 1:1 (Translation • The
  Koren Jerusalem Bible)* — with no way to turn that off short of unlinking
  the title. *Name the edition*, in each title's settings (Preferences →
  Insertion → **Title font**, in the Source and in the Translation section),
  now sets it for each title.
  On (the default) is as before; off, a linked title reads *Genesis 1:1*,
  still linked and in its linked style. With several translations inserted
  at once and the switch off, each title still names its translation, as an
  unlinked title does: *Genesis 1:1 (Koren)*.

### Beta tutorial QA fixes (30 October 2026)

No new preference, no migration. Found while recording the beta tutorials;
each one is in `docs/regression-log.md` with the test that pins it. These
change what an insert writes (the Hebrew credit) and how Transform Divine
Names behaves; they ship in 2.0.0.

#### Fixed

- **The preview shows Combine and Drop as they will be inserted.** With
  *Commentary → Drop* (then *Bold only*) the preview still showed the whole
  translation, explanation included, and the insert then kept only the bold.
  The preview now applies the same rules as the insert: only bold decides,
  so the bold text is kept and the rest goes, a line with no bold goes, and
  a translation with no bold at all is shown whole; italics stays on
  whatever is kept. *Combine* shows every word without the source's bold,
  italics kept. The preview still leaves out line numbers and chapter
  headings.
- **Two translations with the Hebrew on top now credit the Hebrew edition.**
  With *Citation* on, each translation was credited but the Hebrew edition's
  license was left out, though a one-translation insert of the same edition
  had it. It is credited once, under the Hebrew.
- **Link Texts links a citation that follows a label.** Sefaria's linker took
  *Duplicate A: Genesis 2:1* as one citation and could not match it. When the
  words after a label are a reference of their own, they are searched too,
  and only they are linked; the label stays as written. A made-up book after
  a label still stays unmatched.
- **Link Texts asks Google's storage for your settings far less.** A second
  Link Texts run failed with *"a server error occurred while reading from
  storage. Error code RESOURCE_EXHAUSTED."* Every settings read had asked for
  one setting at a time, about 310 reads for a rerun; it is now one read per
  step, about 4. If the settings still can't be read, the dialog says that
  the document was not scanned and nothing was changed, and keeps Google's
  message for a support report. (Which Google service refused is for the
  Apps Script execution log to say; this does not claim to have found it.)
- **Session Library: a pin made in the dialog is no longer lost, and Library
  always reopens.** The dialog hands its changes back through a saved value
  the sidebar waits for. A failed save closed the dialog anyway, a failed
  read looked like "not closed yet", and while the sidebar waited Library
  would not open again until Refresh Sidebar; the wait also gave up after ten
  minutes. Now Done stays open and says so if the changes can't be saved, the
  sidebar keeps waiting for an hour, says so if it can't read them, and
  Library opens whenever it is clicked.
- **A saved divine-name mapping shows its own label when Preferences is
  reopened.** A custom replacement (or a preset other than the first) reopened
  under the page's default label — *G-d*, *יי* — beside the custom field. The
  replacement used was always the saved one.
- **Lexicon no longer shows an earlier search's "No lexicon entries found".**
  Switching to Lexicon looked up what was still in the search box; when that
  answer arrived during the next search, its message stayed above the new
  results. An answer to an earlier search (in Lexicon or Voices, or in the mode
  just left) is now dropped.
- **A layout picked as the sidebar opens is kept.** A choice made before the
  sidebar had loaded your settings was dropped, and the saved default was then
  put back on screen: Stacked could insert as Right–Left.
- **The sidebar says when it can't load your settings.** Until then the
  Insertion Options card doesn't respond (Citation, Bold & italics), and a
  failed load left it that way with no word of why. It is tried once more,
  then the sidebar says so, with Google's message and a way to try again.
  Link Texts, Help and the feedback form say so when they can't open from the
  sidebar, and Link Texts ignores a second click while it opens.

#### Changed

- **Transform Divine Names asks first, and says what it will change.** It
  changes every match in the body of the tab you have open: a selection does
  not limit it, and headers, footers, footnotes and other tabs are left alone.
  It now says so, lists the rules that are on, and asks before changing
  anything; afterwards it says how many names it replaced. What it changes is
  unchanged. Preferences no longer calls it "document-wide".
- **Link Texts' "couldn't be matched" list shows what Sefaria answered to each
  spelling it searched**, not only the row's one reason.
- **Help:** how to keep a citation from splitting across a page (Docs' *Keep
  lines together*; the add-on can't set it); and that a whole book such as
  *Genesis* opens at its first chapter, which is what Add Source inserts (for
  a one-chapter book, the whole book), while a heading with no text of its own
  (*Mishneh Torah*) can't be inserted.
- **Privacy policy (§3, §6):** it now says that the Session Library's list
  passes briefly through Google when its window opens and closes, instead of
  saying it never leaves the browser. That was already untrue before this
  release (the closed window's list was kept in `PropertiesService` until the
  window was next opened); it now goes through the user cache, is deleted when
  the sidebar collects it, and expires within an hour. Opening the window still
  deletes any copy an earlier version left.

### Divine names keep their vowels and cantillation

#### Fixed

- **A divine-name substitute no longer strips the Name's vowels and
  cantillation.** In a pointed verse the substitute was inserted bare:
  *יְהוָ֥ה* became *יי*, losing its niqqud and its ta'am. Now *יְהוָ֥ה*
  becomes *יְיָ֥* (or *יְקוָ֥ק*), *אֱלֹהִ֑ים* becomes *אֱלוֹקִ֑ים*, and
  *יָהּ* becomes *קָהּ*. A substitute that is another word (*השם*, *ה'*)
  keeps the cantillation, and one typed with its own vowels is used as typed.
  Whatever Vowels and Cantillation leave out stays out. The same holds for
  Quick Actions → Transform Divine Names, and for first-run setup's preview.
- A sof pasuq or maqaf right after the Name is kept (*יְהוָֽה׃* lost its
  *׃*), and Transform Divine Names now replaces the Name after a maqaf
  (*אֶת־יְהוָה*), which it used to skip.
- The *אלוהים* rule now matches the Bible's spelling without the ו
  (*אֱלֹהִים*), as Transform Divine Names already did; on insert it only
  matched *אלוהים*.

### Transliteration: HaShem, and capitals

#### Changed

- **The Name is transliterated *HaShem*.** It was spelled out letter by
  letter: *yehvah* for *יְהוָה*, and *yy* or *h'* for a substitute. Now
  *יהוה* and every substitute for it (*יי*, *יקוק*, *ה'*, *השם*) read
  *HaShem*, with a prefix kept (*לַיהוָה* → *laHaShem*). IPA writes it in
  IPA.
- **Sentences start with a capital letter.** The transliteration was all
  lower case. The first word of each line, and the word after a sof pasuq or
  a period, is now capitalized, in every scheme but IPA (where case is part
  of the notation).
- **Names are capitalized.** People, places and peoples of the Tanakh and the
  Talmud, after any prefix (Simple English): *Mosheh*, *miMitserayim*,
  *Beyt-'El*, *Rabiy 'Akiyva*, *veRav Nakheman*, *diShemv'el*,
  *beFvmebediyta'*. The Tanakh's names (about 4,800
  spellings) come from STEPBible.org's tagged Hebrew Bible (CC BY 4.0), each
  kept only if it is a name most of the time, and read by its vowels when it
  has them: *עֵשָׂו* is Esav, *עָשׂוּ* "they did". The Talmud's sages and
  places are a list in `tools/proper-names/`; one that is also a word
  (*מאיר*, *ששת*) is capitalized only after *רבי*, *רב*, *ר'*, *מר* or *בן*.
  Help → About → Credits credits STEPBible.

#### Fixed

- A maqaf was copied into the transliteration as the Hebrew mark (*Beyt־'El*);
  it is a plain hyphen now (*Beyt-'El*, *kol-ha'am*).
- Cantillation marks and the meteg were copied into the transliteration
  (*yehva֥h*, *'ekhaֽd*): only the first cantillation mark in a passage was
  removed. They are all dropped now.

### Drop (once "Bold only"): the translation's bold, without its commentary

#### Changed

- **Commentary → *Drop* (then *Bold only*, before that *Only*) keeps the
  bold alone.** Sefaria sets its direct translation in bold and the
  commentary around it in plain text (the Steinsaltz Talmud), and italicizes
  a foreign or transliterated word (*Shema*, *teruma*) wherever it falls.
  *Only* chose by bold or italics, so an italicized word from the commentary
  came along with the translation. Now only bold decides: an italic word goes
  or stays with the text it is in, and keeps its italics when it stays. The
  stored value (`source_emphasis_mode = "only"`) is unchanged, so no
  migration.

### Link Texts: which citations didn't match, and why

#### Added

- **A "Not matched" list in the Link Texts dialog.** Where the dialog used to
  say only "3 citations could not be matched to a Sefaria source", it now has
  a collapsed **▸ Show 3 citations that couldn't be matched** under the review
  table (or under the message, when nothing could be linked). It lists each
  one's words in your document with the sentence around it, every spelling
  that was looked up, and why none matched: a chapter, verse or page the book
  doesn't have (with Sefaria's own message, e.g. *Genesis ends at Chapter
  50*), a book name Sefaria doesn't recognise, or a citation that points back
  to an earlier one (*ibid.*, *there*, *שם*).

#### Changed

- **Link Texts tries the same spellings as the search box.** A citation
  Sefaria's linker can't match is looked up again the way the sidebar search
  looks up a typed reference: punctuation made consistent, Hebrew numerals
  without their geresh/gershayim, and traditional abbreviations written out
  (*Hil. Shabbat 1:1* → *Mishneh Torah, Hilchot Shabbat 1:1*). One found
  this way is linked like any other single match, and its row says which
  spelling found it. Only the citation's own words are sent for these
  lookups, and at most 30 citations per scan are retried.
- A citation that couldn't be matched but is already a hyperlink in your
  document is no longer counted as a failure, and one the partial scan split
  in two is reported as *fell across a gap in the partial scan* (the remedy
  is *Whole document*) instead of as unmatched.

### Help and walkthroughs

#### Changed

- **Help describes the new interface.** *The sidebar at a glance* puts Texts /
  Voices / Lexicon under the search box and Insertion Options under Add
  Source; a new **Simple or Everything** section says what Simple hides in the
  sidebar, the menu and Preferences, and how to get it back; Insertion Options
  covers Display, the Citation / Line by line / Line numbers switches, the
  folding Source and Translation sections row by row, the font panel and
  *Updating preview…*; Preferences lists the Interface switch, the Search tab,
  Fonts → Citation and the save spinner. Troubleshooting adds a missing tab
  (Simple mode), a preview that hasn't caught up, and borrowed cantillation
  marks.
- **First-run setup and Preferences no longer name controls that are gone.**
  Setup's Simple choice said the other tools were "under More options", which
  Simple mode no longer has, and Everything said it added Link Texts, which
  Simple has too. Preferences → Fonts → ✒️ Source Emphasis pointed to "the B&I
  button in the sidebar's Layout tray"; it is *Bold & italics* in Insertion
  Options.
- The Google Docs walkthrough, the README and the five walkthroughs in
  `docs/walkthroughs/` use the current names and places throughout, and cover
  first-run setup, Simple mode, separate source and translation titles, the
  citation style and the three-way Vowels and Cantillation.

### Sidebar fixes

#### Fixed

- **Several translations with the source no longer inserted.** The Source
  editions list shared a class with the Translation versions list, so
  refreshing the translations also filled the Source editions with translation
  titles. The Hebrew was then fetched by a translation's name, and choosing a
  source edition reset the translations. Each list now updates only itself.
- **A multi-selection of translations reset itself.** A plain click replaced
  the selection (only <kbd>Ctrl</kbd> / <kbd>⌘</kbd> added to it). Any
  Insertion Options change, a new source edition, or typing in the filter box
  also dropped every translation but one. Now each click adds or removes one
  translation. The selection survives those changes, and the filter box only
  narrows the list.
- **It wasn't clear what would be inserted.** Picking a translation could
  leave no option visibly selected, and the filter box quietly moved the
  selection to its first match. The preview now lists the selected
  translations in insertion order, and the box under the list always names
  what is selected.
- **Choosing a translation made the source edition look deselected, and the
  reverse.** The add-on's own list colours covered the browser's highlight in
  whichever list wasn't focused, and after each choice the preview reload left
  neither focused. The choice was still there, just invisible. A selected
  version now stays highlighted in both lists.
- **A misclick could leave nothing selected.** <kbd>Ctrl</kbd> / <kbd>⌘</kbd>
  + click on the selected item emptied either list, and Insert then used
  whatever the preview had last loaded. Now the last selection stays and the
  sidebar says why. A multi-version insert that skips translations with no
  text no longer leaves the list empty either.
- **Voices' Both inserts the sheet's text under a linked title.** It used to
  insert the whole Citation (title, summary, "Curated by … • Topics … •
  link") and then the text under its own title, so the title appeared up to
  three times. Both is now the text, its title linked to the sheet on Sefaria.
  Citation also leaves out a summary that only repeats the title (many authors
  type the title again as the summary).
- **A Vowels choice in the sidebar could be lost.** The sidebar saved each
  change to the session with its own server call, and each call read, merged
  and wrote the whole session, so with two in flight (a Vowels click and then
  any other click) the later write dropped the earlier change. The preview
  could look right while the insert used the old vowels. Saves now go one at a
  time, with changes made meanwhile sent together in the next one.
- **Switches flipped back, or missed a click.** Each save's answer re-drew
  every switch from that answer, so a quick second click was shown undone
  until its own answer came, and clicked again. The switches now change at
  once and are only re-drawn when nothing is left to save. A change to what
  is fetched (Vowels, Cantillation, Punctuation, Transliteration) disables
  Add Source and re-fetches the selected text once, after the clicks stop and
  the saves land; before, a second change made while the first re-fetch ran
  was not fetched at all.
- **No sign that Preferences was opening.** Clicking ⚙︎ (or "Colour, style
  and more…") now shows *Opening Preferences…* over the sidebar until the
  dialog is on its way, and further clicks do nothing meanwhile, so it can't
  be opened twice.
- **Hebrew "Punctuation: Off" now applies to the transliteration.** The
  transliteration was read from the Hebrew as fetched, punctuation included,
  so with the Hebrew's punctuation off it still carried the sof pasuq and
  joined maqaf words with a hyphen (*kol-ha'am*). It follows the Hebrew
  setting now (*kol ha'am*), in the insert, the sidebar preview and the
  Insertion Options sample; vowels are still read as fetched, as before.
- **The transliteration Style, and the end of Insertion Options, could not be
  reached.** The tray never scrolled: whatever did not fit was cut off. With
  Display set to Translation or Both, the tray is taller, so the Source
  section's transliteration *Style* (and the Translation section below it) was
  out of reach; only Original was short enough to show it. The tray scrolls
  now.
- **The preview kept showing the old text after a change.** A change the
  fetch applies (Vowels, Cantillation, Punctuation, Transliteration) takes a
  few seconds to save and re-fetch, and meanwhile the preview showed the text
  as it was. It now says *Updating preview…* at once. Preferences saved in the
  Preferences dialog now reach an open sidebar too (its switches, Insertion
  Options and the preview), instead of only the next insert; a setting changed
  for the session in Insertion Options keeps its session value.
- The Traditional transliteration sample read *ha-ēfer*; it is *ha-sēfer*.

### Citation style

#### Added

- **Preferences → Fonts → Citation.** Font, size, bold / italic / underline,
  colour and highlight for the citation under each inserted source (the
  editions and their licenses), with a preview. *Same as the text above* and
  a blank size keep the font and size of the passage the citation follows.

### Titles: link and font each one separately

#### Added

- **Link the source title and the translation title separately.** The single
  *🔗 Title* switch is now a *Link title to Sefaria* switch in each section of
  the composition card (Insertion Options, Preferences → Insertion, Link
  Texts' *Customize this insertion*): one for the source (Hebrew) title, one
  for the translation title. Insert from Selection and Link Texts follow the
  saved switches; a citation that was already a link still links both titles.
- **Title font in the sidebar.** Insertion Options' Source and Translation
  sections each have a *Title font* button beside *Text font*, as Preferences
  now does too. It is that title's font whether or not it is linked. Like the
  other settings there it is for this session until saved.
- **Separate source and translation title styles in Preferences.** Fonts →
  Title has a *Translation title* / *Source title* switch; each shows that
  title's font, size, style, colour and highlight, and a **Hyperlink
  formatting override** switch. With the override on (the default), a linked
  title is formatted as set under it instead; off, it keeps the title font.
  The source title's font lists are the Hebrew fonts. The paragraph style
  (Normal text / Heading 1–6) stays shared.

### Vowels and Cantillation: three choices each

#### Changed

- **Vowels: Off / Tanakh / On.** A three-way control in the composition card
  (Insertion Options, Preferences, Link Texts) replaces the Vowels switch and
  Preferences' separate *Vowels only in Tanakh* section. *Tanakh* keeps the
  vowels in Tanakh and removes them everywhere else, as the original add-on
  did.
- **Cantillation: Off / Tanakh / Torah.** *Tanakh* keeps the marks in Tanakh
  only; *Torah* keeps them in the Five Books only. An existing "on" shows as
  *Tanakh* and inserts exactly as before until another choice is clicked.

### A cleaner sidebar, Insertion Options and Preferences

#### Changed

- **Layout becomes Insertion Options.** The *📰 Layout* button beside Add
  Source is now **📰 Insertion Options**, a full-width button under Add
  Source, and the panel it opens is titled the same. Inside, "Display &
  Layout" is now **Layout**, and its second picker is called *Arrangement*
  (also in Preferences → Insertion and Link Texts).
- **Revert and Save as defaults are at the top** of Insertion Options, under
  its title, instead of at the bottom.
- **Texts / Voices / Lexicon sit under the search box**, with the results
  they choose between, as a segmented control. Switching runs the same search
  in the other tab, so there is nothing to retype.
- **Citation first.** In Layout, *Citation* comes before the line options
  (*Line by line*, *Line numbers*).
- **One row per setting.** The composition card and the line options are a
  settings list: each setting's name on the left, its control on the right —
  a switch for on/off (*Punctuation*, *Transliteration*, *Link title to
  Sefaria*, *Citation*, *Line by line*, *Line numbers*), a button for a font, a
  segmented control for a choice (*Vowels*, *Cantillation*, *Bold &
  italics*). The centred pills that wrapped into uneven clusters (*Vowels:
  On*, *Line #s: On*…) are gone, as is the card-inside-a-card framing.
- **Display and Arrangement are segmented controls**, always visible and
  labelled, instead of two dropdowns.
- **Bold & italics is a three-way control** (*Keep* / *Drop* / *Only*)
  instead of a button that cycled through three looks of "B&I".
- **Transliteration's scheme** shows under the switch, as *Style*, only while
  transliteration is on.
- **Simple mode has no "More options".** Add Source, Insertion Options and
  the footer's Session Library, Quick Actions and Preferences buttons show in
  both modes. Simple mode still hides the result sort and Restore Corpus, and
  the Texts / Voices / Lexicon tabs while in Texts; Preferences → Interface →
  Everything shows them.
- **Quieter Preferences controls.** The Texts / Voices / Lexicon defaults tabs
  and the title tabs are light segmented controls, and a colour left on
  *Auto* / *None* is marked in pale blue instead of a solid navy block.

### Layout Settings, dialogs and setup

#### Changed

- **Source and Translation fold away.** In the composition card (the Layout
  tray, Preferences' insertion preview, Link Texts' *Customize this
  insertion*), the Hebrew settings and the translation settings are each a
  section that folds to one line saying what is set (*Vowels, Cantillation,
  Punctuation · Translit*; *Punctuation · B&I kept*). Click it to open the
  sample and its switches. They start folded in the Layout tray and Link
  Texts, open in Preferences. With Display set to the translation alone the
  Source section is hidden, and with the Hebrew alone the Translation section.
- **Line #s and Citation, beside Line by line.** The *Lines* and *🔗 Sources*
  buttons are renamed **Line #s** (number each verse or line) and **Citation**
  (the edition and license credit under the text), and moved from the bottom
  of the card to the row under the Display and Layout pickers, next to *Line by
  line*.
- **B&I sits with the translation.** The bold-and-italics button moved next to
  the translation's *Punctuation* button, and its tooltips now say what it
  does: it acts on the translation's bold and italics.
- **Fonts say less.** The font buttons, the font panel, the font lists and
  Preferences → Fonts no longer explain which marks a font lacks or offer to
  stop borrowing them; the font lists are one *Hebrew fonts* group. Help
  explains the borrowing once, under Layout Settings. A warning stays for a
  saved font that Google Docs does not have.
- **The welcome dialog looks finished.** First-run setup has a header with the
  name and a three-step progress bar, a one-line introduction, choices as
  pills that highlight when picked, a preview framed like a page, and proper
  Continue / Back buttons.

#### Fixed

- **Saving looked like a hang.** Saving in Preferences (Save Defaults, Save &
  Close, Reset To Defaults, Refresh, switching Simple / Everything), Link
  Texts' *Save as defaults*, and finishing first-run setup now cover the dialog
  with a spinner and what is happening (*Saving preferences…*) until the
  server answers. Before, the only sign was a small spinner in the footer, or
  none at all.
- **B&I *Discard* also removed the Hebrew's bold.** The B&I setting applies to
  the translation only. *Discard* was still applied to the Hebrew, dropping
  the bold Sefaria puts on a word like the Mishnah's opening מֵאֵימָתַי. The
  Hebrew now always keeps its own bold and italics.
- **Transliteration read the stripped Hebrew.** With Vowels (or Punctuation)
  off, the transliteration was made from the Hebrew as inserted, so it spelled
  out bare consonants. It is now always read from the fully vowelled text
  Sefaria sends, whatever the Hebrew shows; the divine-name substitutes still
  apply. Same in the sidebar preview and in *Line by line* rows.

### Source bold and italics

#### Fixed

- **"Keep only" deleted most of the Hebrew.** The B&I button's *Keep only*
  setting is for the translation: from Sefaria's English Talmud it keeps the
  Talmud's own (bold) words and drops Steinsaltz's explanation. It was also
  applied to the Hebrew, where the only bold is a word like the Mishnah's
  opening מֵאֵימָתַי or "גמ׳", so a Berakhot 2a insert kept those words and
  little else. The Hebrew is now inserted whole, with its own emphasis kept.

### Hebrew fonts without cantillation

#### Fixed

- **Empty boxes instead of cantillation marks.** Many Hebrew fonts have the
  letters and vowels but no cantillation at all: David Libre, Frank Ruhl Libre,
  Heebo, Alef, Rubik and most other Hebrew Google Fonts. Docs drew each mark as
  an empty box (reported on a Mac with David Libre). Now only the marks the
  font lacks are set in Noto Serif Hebrew, or Noto Sans Hebrew for a
  sans-serif font; the letters, and every mark the font has, stay in your
  font. Applies to "Match the document" too, using the document's font.

#### Added

- **Font buttons in the Layout tray.** Under the Hebrew and translation
  samples, a button names the font each will be inserted in and opens a small
  panel to change the font and size. In the Texts tab these are session
  settings, like the pills; **Save as defaults** keeps them. The same buttons
  are in Preferences' insertion preview and Link Texts' *Customize this
  insertion*.
- **The preview is drawn in the real font.** The samples load the chosen font
  (or the document's) and draw the marks it lacks the way the insert will:
  borrowed from Noto.

#### Changed

- **Honest font lists.** Every font list comes from one place, with the
  Hebrew fonts first. David Libre and other Google Hebrew fonts are new to the
  lists. Ezra SIL, SBL Hebrew, David
  and Taamey Frank CLM are no longer offered: they are not Google Docs fonts,
  so Docs showed the text in another font. A saved choice of one is kept and
  labelled "(not in Google Docs)".

> **Preference migration (schema 20). Existing users keep the full interface
> and never see first-run setup.** New preferences `ui_mode` (default `full`),
> `first_run_setup` and `menu_layout_before_simple`. Upgrading users are
> migrated on first open to `ui_mode = full` and `first_run_setup = done`
> (only when unset), so **nothing they have is hidden and nothing changes**.
> A user with no stored settings at all (a new install, or a user of the
> original published add-on, which stored none) is shown the setup once; it
> keeps Full mode unless they choose Simple. See
> [`docs/first-run-setup-design.md`](first-run-setup-design.md).

### First-run setup and Simple mode

- **Setup for new users.** The first time a new user opens the add-on, a short
  dialog asks what they will use it for, how sources should look (Hebrew and/or
  translation, arrangement, vowels, cantillation, how to write God's name,
  translation language, with a live preview of Deuteronomy 6:4) and how much of
  the add-on they want to see. Every answer starts at their current setting, so
  clicking through changes nothing. It is shown once; **Help → Run setup again**
  reopens it.
- **Simple mode.** Search, preview and insert, with the Texts / Voices / Lexicon
  tabs, sorting, Layout, Session Library and Quick Actions under **More
  options** in the sidebar, a shorter menu (Texts, Insert Source from Selection,
  Transform Divine Names, Link Texts), and the Search, Linking and Experimental
  tabs of Preferences behind **Show advanced settings**. Nothing is removed.
  Switch between **Simple** and **Everything** at the top of Preferences;
  switching back restores the menu you had.
- **What's new** in Help → About opens the release notes, which until now only
  appeared on install.

> **Preference migration (schema 19).** New preference
> `bilingual_aligned_rows`, default `false`. Upgrading users are migrated on
> first open to `false` (only when unset), which is the one-row side-by-side
> table every insert has had, so **no existing output changes**. It is a new
> layout to switch on, not a gate on an old behaviour.

### Side-by-side layouts

#### Added

- **Line by line: one table row per verse.** With Right–Left or Left–Right,
  the new **Line by line** button under Display & Layout (sidebar Layout tray,
  Preferences → Insertion, Link Texts' *Customize this insertion*) gives each
  verse or line its own row, beside its translation, so the two are easy to
  compare. Line markers number each row as before; transliteration goes under
  each row's own Hebrew. Sources whose text can't be split into lines still
  insert as one row.

> **Preference migration (schema 18).** Two new preferences,
> `hebrew_punctuation` and `translation_punctuation`, both default to `true`
> (punctuation shown). Upgrading users are migrated on first open: each key is
> set to `true` only if it has no stored value, so an explicit `false` is never
> overwritten and **nobody's inserted text changes** until they switch one off.

### Punctuation

#### Added

- **Punctuation: On/Off for the Hebrew and for the translation, separately.**
  For teaching Torah and Talmud with the Hebrew unpunctuated (and, if you
  like, the translation too). The composition card in the sidebar's Layout
  tray, Preferences → Insertion, and Link Texts' *Customize this insertion*
  has a pill under the Hebrew and a new **Translation** group with its own
  pill. Off removes sof pasuq, paseq, the {פ}/{ס} parasha markers, commas,
  periods, quotation marks and the like; the maqaf becomes a space. Kept:
  abbreviations and contractions (ר', רש"י, don't), G-d, numbers (3:16,
  1,000), footnote markers, and the source's bold and italics. Divine-name
  substitutes (ה', G-d) are applied afterwards and never stripped. Citations
  are never changed.

> **Preference migration (schema 14).** `source_emphasis_mode` (`keep` /
> `discard` / `only`) replaces the on/off `preserve_source_emphasis`.
> Upgrading users are migrated on first open: on becomes `keep`, off becomes
> `discard`, and the old key is removed. Inserted text doesn't change for
> anyone until they pick the new option.

### Source emphasis

#### Added

- **B&I button in the sidebar's Layout tray**, next to Lines and Sources. It
  cycles through **Keep** the source's bold and italics (highlighted),
  **Discard** them (faded), and **Keep only** (inverted). Keep only inserts
  just the bold words. For example, from Sefaria's English Talmud
  (Steinsaltz) it keeps the bold translation of the Talmud's own words and
  leaves out Steinsaltz's explanation. Line markers are kept. Lines with no
  bold are left out. A passage with no bold anywhere (the Aramaic original)
  is inserted whole. *(Now Commentary: Default / Combine / Drop; Combine
  drops only the bold, and italics is kept in every mode. See the top of
  this section.)*

#### Changed

- **Preferences → Fonts → ✒️ Source Emphasis** has a three-way
  **Keep / Discard / Keep only** control in place of the on/off switch. The
  Insertion Defaults preview card has the same B&I button.

### Insertion and linking

#### Fixed

- **An inserted source is titled with the text you chose, not your search.**
  Searching for "shema" and inserting Deuteronomy 6:4 titled the source
  "shema"; the title is now the chosen text's reference.
- **The Layout tray's Cantillation pill reaches the inserted text.** In the
  Texts tab, turning Cantillation (or Vowels, or either Punctuation pill) off
  in the Layout tray changed the pill but not the preview or the insert, which
  kept the marks until the setting was saved as a default. Those pills set an
  override for this sidebar only, and the text was fetched with the saved
  preferences alone; it is now fetched with the sidebar's overrides on top. A
  transliteration scheme picked there now reaches the insert too.
- **A range across chapters shows where each chapter starts.** With line
  numbers on, Genesis 1:31–2:3 read "(31) … (1) … (2) … (3)", with nothing to
  say the numbers had restarted. Each chapter now gets a heading line in the
  text's own terms ("Chapter 2" / "פרק ב", "Daf 2b" / "דף ב ע״ב"), in the
  Hebrew and the translation alike. Commentary → *Drop* keeps the
  headings, and a transliteration's verse numbers restart with the chapter
  too. Inserting several translations of such a range no longer fails.
- **Several translations at once are all formatted alike.** Inserting more
  than one translation of a source gave only the first one your formatting.
  With fonts on *Match the document* (the default), the second and later
  translations, their titles included, took on the small italic size of the
  credit line above them. Every translation block now looks like the first.
- **Inserting from inside a table now works, and says what it did.** With
  the cursor in a table cell, the source used to land somewhere else in the
  document without a word, and the same went for Voices sheets and Lexicon
  entries. Now one language, the Stacked layout, several translations, sheets
  and lexicon entries go **inside the cell**, below the cursor. Right–Left and
  Left–Right are tables themselves, so they go **directly below the table**,
  and the sidebar says why. A header, footer or footnote gets a message asking
  you to click in the main text.
- **Verse numbers across a chapter break.** `Genesis 1:31-2:3` with line
  markers numbered the English (1), (1), (2), (3); it now reads (31), (1),
  (2), (3), like the Hebrew.
- **"Couldn't reach Sefaria" is no longer reported as "no match".** With no
  connection, Insert Source from Selection said *No Sefaria source matched*,
  and the sidebar said to check the spelling. Both now say Sefaria couldn't
  be reached.
- **Link Texts waits longer for long documents, and says so if it gives up.**
  It used to stop after about 5 seconds and report *no citations found*. It now
  waits about 30 seconds, and if Sefaria is still working, it says so.
- **Editing the document while the Link Texts review is open no longer moves
  links.** Each citation is found again when you click Apply. A citation you
  deleted in the meantime is reported, not linked somewhere else.
- **Link Texts' per-row Insert** puts the source below the citation's own
  paragraph, including inside a table cell, and no longer moves your cursor.
- **Sidebar messages are visible.** The short messages at the bottom of the
  sidebar (for example after Insert from Selection fails) were shown fully
  transparent.
- **Shulchan Arukh (and other texts with commentary markers) insert in
  full.** Inserting Shulchan Arukh, Orach Chayim 669 stopped after the Hebrew
  heading with *TypeError: Cannot read properties of null (reading '1')*,
  leaving no translation and no source credit. Sefaria's links to commentaries
  in the text are now skipped instead of stopping the insert.
- **A source with no translation inserts just the Hebrew.** Siddur Rashi used
  to get an empty "(Translation)" heading, and its Hebrew title read
  `רש&quot;י` instead of `רש"י`.
- **Link Texts' Insert no longer repeats the citation.** With Preferences →
  Insertion → *“Insert from Selection” replaces the selection* on (the
  default), a citation on a line of its own is now replaced by the inserted
  source, titled with the citation as you wrote it and still linked to
  Sefaria, the way Insert from Selection does it. It used to stay in place
  with the same reference repeated as the source's title on the next line. A
  citation inside a sentence is left alone, and the source goes below it.
  Turn the preference off to keep every citation.
- **Link Texts names a source it could not insert.** The summary said
  *could not be fetched* for every failure, and showed the error without
  saying which source it belonged to.

#### Added

- **Formatting for specific translation languages** (Preferences → Fonts →
  Translation → *Advanced: formatting for specific languages*). Pick a
  language to add it to the list, then give it its own font, size and style:
  say, a different font for French translations. Languages you don't add keep
  the Translation settings, and so does a blank font or size. **Remove** takes
  a language back to them. It applies wherever a translation is inserted:
  one translation, several at once, Stacked and side-by-side layouts, and
  Link Texts.
- **Customize this insertion, in Link Texts' review.** A collapsible panel
  under the review table has the same controls as the sidebar's 📰 Layout
  tray: Display, Layout, vowels, cantillation, transliteration, the linked
  title, Lines, Sources and B&I, plus whether a citation on its own line is
  replaced. The settings apply only to the sources this pass inserts; your
  defaults don't change unless you click **Save as defaults**, and **Revert
  to defaults** puts them back. There's no longer any need to cancel the
  review, or change Preferences for every future insert, to insert one batch
  differently.
- **Preferences → Insertion → Display & Layout uses the sidebar's pickers.**
  Same options, same names (*Translation*, *Original with Translation*,
  *Original*; *Stacked*, *Right–Left*, *Left–Right*), laid out open as before.
  The sidebar's Layout tray, Link Texts' *Customize this insertion* and
  Preferences now share one set of these controls, so they can't drift apart.
- **Preferences → Insertion → Vowels only in Tanakh.** Keeps niqqud in Tanakh
  and removes it from everything else, as the original add-on did. Off by
  default; no stored preference changes.

### Loading indicator

#### Changed

- **The sidebar's "working" screen is easier to see and says what it's
  doing.** Sefaria's small gray spinner on a blank white panel is gone. The
  sidebar now dims behind a card with the Sefarrow, which fills and empties
  clockwise inside a spinning ring, and a label: *Inserting into your
  document…*, *Fetching the sheet…* (a sheet inserted with its contents),
  *Looking up your selection…* (Insert from Selection) or *Updating divine
  names…*. A small shape under the label matches: lines of text writing in,
  dots dropping in, or a highlighter sweeping across. A search shows a
  scanning magnifying glass and *Searching Sefaria…* above the placeholder
  results. With reduced motion turned on, the animations run slowly.

### Controls and Google's stylesheet

#### Fixed

- **The Session Library's sort dropdown ("By Category") lost its hatched
  background.** Google's add-on stylesheet styles every bare dropdown, button
  and text box, and some of its rules out-ranked ours, so its pattern showed
  through. Google's sheet now loads underneath everything the add-on writes
  (a CSS cascade layer), so our styles win whatever Google changes.
- **The Session Library window no longer shows a stray "Search references"
  label** beside its search box. The search box is full width again.
- **The sidebar's Texts / Voices / Lexicon tabs centre their labels.** The
  labels sat at the bottom of each tab, pushed down by space reserved for the
  result-count badge, which is drawn in the corner and never needed it.

#### Changed

- **Dropdowns, text boxes, checkboxes, colour pickers and buttons now take their
  look from the add-on, not Google.** `apps-script/shared/css/native-controls.html`
  sets every control type from one set of tokens. Every dropdown has the same
  chevron, and checkboxes and radios use the add-on's navy. Buttons that used
  Google's blue (*Save Defaults*, *Save & Close*, Surprise Me's *Insert*) are
  navy too.

### Search

#### Fixed

- **No more dead end at "Choose a more specific ref".** Typing a whole book or
  section heading (*Mishneh Torah*, *Shulchan Arukh, Orach Chayim*) listed it as
  a direct library match, and picking it stopped at "Choose a more specific
  ref" with nothing to do but start over. A direct match with no text of its own
  is now left out of the results (along with a title match for the same
  heading), and a note under the search box says what to add — a chapter, a
  siman, a verse. If you still reach one (a Sefaria link, a title match the
  search couldn't check), the sidebar shows the notice for a moment, then goes
  back to your results with that entry removed, nothing selected, and the cursor
  in the search box.
- **Titles no longer have to be punctuated exactly.** Sefaria's title is
  *The Torah; A Women's Commentary* — with a semicolon — and the reference
  lookup only matched that exact punctuation, so
  `The Torah, A Women's Commentary, Deuteronomy 29:9-14`,
  `The Torah: A Women's Commentary …` or `the torah a womens commentary
  deuteronomy 29 9-14` found nothing. Titles are now compared by their words
  alone (case, apostrophes and punctuation ignored), and the lookup rewrites
  the title to Sefaria's spelling; the chapter and verse are kept as typed. The
  as-you-type title list matches the same way.
- **The search box no longer fights you while you type.** Each as-you-type
  search wrote a tidied copy of the query back into the box, which removed a
  space you had just typed (`Deuteronomy ` → `Deuteronomy`) and moved the cursor
  to the end if you were editing in the middle. The query is now tidied only
  when you press Enter or click a search, history entry or suggestion.

#### Changed

- **Close matches are listed on every search.** Titles that are near-misses for
  what you typed (a typo, a missing word, a different spelling) now appear
  under a *Close matches* heading after the exact results, with your chapter
  and verse carried over. Before, they appeared only when a search returned
  nothing at all — which almost never happened, because the full-text search
  nearly always returns something. Close matches are never opened
  automatically; click the one you meant.
- **Corpus groups follow an order you choose.** Text search results group
  corpora in a fixed library order (Tanakh, Mishnah, Talmud, Midrash, …)
  instead of whatever order the search returned them in. The *Library* group
  (direct references, title and name matches) stays first and *Close matches*
  second. The sort menu still orders results *within* each group.

#### Added

- **Reorder and hide corpora** (Preferences → *Search*). Drag a row, or use its
  arrows, to set the order corpora appear in text search results; *Close
  matches* can be moved like any corpus, and only *Library* is pinned. Each row
  can be hidden. A hidden corpus can still be shown for one search from the
  sidebar's *Restore Corpus* menu, where it is marked "(Preferences)".
  Corpora not in the list appear last, in relevance order.

#### Migration

- **Preference schema v15** adds `search_corpus_order` and
  `search_corpus_excluded`, both defaulting to `"[]"` — the built-in order with
  nothing hidden. Upgrading users lose no results, and a stored value is never
  overwritten.

### Preference migration (schema 16)

- **Preference schema v16** adds `translation_language_typography`, a JSON
  map from a translation language to its own font, size and style. It
  defaults to `"{}"`: no language has its own formatting, so no translation
  looks different after upgrading. A stored value is never overwritten.

### Translation versions

#### Fixed

- **Translations with no text for the passage are no longer offered.**
  Sefaria lists every translation of a *book*, so a translation that covers only
  part of it — the Yiddish on Deuteronomy 6:4 — appeared in *Translation
  versions* for every verse, looking like any other, and only turned out to be
  empty once picked. The sidebar now asks Sefaria which versions have text for
  the exact passage (once per passage, after the preview loads, so the preview
  is not slowed) and leaves the empty ones out. The *N available* count counts
  only what is listed. If that lookup fails, nothing is hidden.

#### Added

- **Show unavailable translations** (Preferences → *Search* → *Advanced*, off by
  default). Lists the empty translations anyway, greyed out and marked
  *unavailable for this ref* — for tracking down gaps in Sefaria's data, its
  API, or this add-on's filters.
- **Choose which translation languages to show** (Preferences → *Search* →
  *Translation Languages*, all shown by default). An unticked language is left
  out of the sidebar's search language filter and out of *Translation
  versions*. If that would leave a passage with no translations, they are all
  listed.

#### Migration

- **⚠ Preference schema v17 changes what upgrading users see.** It adds
  `show_unavailable_translations`, seeded `false`: translations with no text
  for the passage, which every user saw listed before, are now left out of the
  version list. Nothing that inserted text stops inserting it — those versions
  never had any. Turn the new setting on to list them again (greyed out). It
  also adds `hidden_translation_languages`, seeded `"[]"`, so every language
  stays listed. A stored value is never overwritten.

## 2.0 development, August–September 2026: linking you can review, source credit, and Marketplace readiness

> Never published on its own: it ships as part of v2.0.0, above.

Highlights: Link Texts with Sefaria shows its progress, asks about ambiguous
citations and reports what it could not link, and uploads only likely-citation
passages by default; inserted sources carry a credit line with their licenses;
colour, highlight and source-emphasis controls; a customizable menu; better
search recovery; and the security, privacy and Marketplace fixes from the
pre-publication review.
Preference schema **13** — upgrading users are migrated on first open.

### Marketplace readiness (2026-09)

> **Default change: source credit is now on.** New installs, and users
> upgrading from the published add-on, get a small credit block (edition and
> license) under every inserted source. Many Sefaria texts are CC-BY or
> CC-BY-NC. Anyone already running an earlier build keeps the setting they had.
> Turn it off in Preferences → Insertion.

#### Fixed

- **The add-on's menu now appears right after installing.** `onInstall` never
  built the menu, and `onOpen` does not fire for the document you install
  from, so the menu only showed up after a reload. `onInstall` now seeds
  preferences and then builds the menu. `onOpen` also no longer ends with no
  menu at all if a preference migration or preference read fails: it falls
  back to the default menu.
- **The יה replacement no longer rewrites other words.** It matched the start
  of יהודה, יהושע, יהי and others (יהודה became קהודה). It now replaces יה only
  as a whole word; הללו־יה still matches. יהוה and אלהים are unchanged and
  still match with a prefix (לַיהוָה).
- **Replacement text is used exactly as typed.** A `$&` or `$1` in a
  divine-name replacement was expanded as a pattern.
- **Turning niqqud off no longer removes punctuation.** Paseq, sof pasuq and
  nun hafukha were stripped along with the vowels.

#### Added

- **Credit for the Hebrew edition.** The credit block names the Hebrew edition
  and its own license whenever Hebrew is inserted, including Hebrew-only
  inserts, which used to get no credit at all.

#### Changed

- **The "Open on Sefaria" icon is bundled into the add-on** instead of being
  loaded from the-merkaz.org, so opening the sidebar contacts one host fewer.
  It is the same Sefarrow mark, as a transparent 64 px image that stays sharp
  on high-density screens.
- **Help and Release Notes are written for users.** The About tab and the
  Release Notes dialog had developer notes in them ("UX and maintenance fork",
  "Core 2.0 fork direction", "Deferred backlog"). They now describe what's new,
  what the add-on does, and its version history, and say that the
  add-on is independent of Sefaria.
- **Privacy policy lists every host the add-on's windows load from**
  (§2.2): jQuery and a stylesheet and font from Google, images from Sefaria,
  and Sefaria's feedback form when you open it. None of these requests carries
  your document or your searches. The previous wording ("talks to exactly two
  parties") was not accurate.
- **Links point at the publishing repository.** The privacy-policy links
  (Preferences, Help → About) pointed at the OtterBrainDev fork, and the GitHub
  links at the original `shelfgot/SefariaAddOnForDocs`. Both now point at
  `TheMerkazDev/TorahLibraryAddOnForDocs`. Bug reports go to
  help@the-merkaz.org, since that repository has Issues turned off.
- **Text search uses Sefaria's current route**, `/api/search-wrapper/es8`,
  instead of the Elasticsearch 6 compatibility alias.

#### Security

- **Every dialog carries the image Content-Security-Policy.** Help, Feedback,
  Release Notes, Link Texts and Gematriya Count had none; a test now keeps all
  copies identical to the shared one.
- **Every dynamic jQuery `.html()` write is reviewed and annotated**, and the
  pre-deploy check now fails on a new unannotated one (it only warned).
- **Deploys install a lockfile-pinned clasp** (`tools/clasp/`), with every
  dependency hash-checked and install scripts disabled, instead of resolving
  clasp's dependencies fresh on each deploy in the job that holds the deploy
  credential. clasp is deploy tooling only and never reaches users.

#### Removed

- **The hidden AI Shiur interface.** The feature was detached earlier, but its
  sidebar card, footer button and supporting code still shipped, hidden. It is
  preserved on the OtterBrainDev `ai-shiur` branch.

#### Deployment

- **The deploy workflow is no longer tied to one repository.** It pushes to the
  Apps Script project in the `CLASP_SCRIPT_ID` repository variable and is
  skipped where that is unset, so it behaves correctly in both OtterBrainDev
  and TheMerkazDev. **OtterBrainDev must set `CLASP_SCRIPT_ID` to keep
  deploying** — it no longer comes from `.clasp.json`.
- The deploy's `CLASP_TOKEN` may come from either clasp 2 or clasp 3's
  `clasp login` (it only accepted clasp 3's before), and
  `tools/clasp/README.md` walks through setting it up. Until it is set up, the
  workflow is skipped instead of failing on every push to `master`, as it had
  been.
- Deployment is described as users experience it: `clasp push` updates HEAD for
  test deployments only; users get the version selected in the Marketplace SDK.

#### Documentation

- `docs/marketplace-listing.md` is now the full store console package: consent
  screen, App Configuration, store listing copy, graphics and screenshot list,
  pre-submission checklist, and open items.
- New `docs/TERMS.md` (draft, for review) for the listing's Terms of Service URL.
- README: current file layout, no placeholder links, and the unrelated "UI
  Refactor Pack" section removed. `docs/architecture.md` describes
  `server/*.gs` instead of the old `Code.gs`.
- The live test checklist covers every change in this release and has a
  Results table.

### Pre-publication security fixes (2026-09)

#### Security

- **The Sefaria-HTML sanitizer is now an allowlist.** The previous version
  removed a list of dangerous elements and kept everything else, and was
  bypassed by mutation XSS: MathML/`xmp` markup that serializes to one string
  and re-parses into an `<img onerror>` once the sidebar renders it. Reproduced
  in Chromium through the real preview and search-result render paths. Search
  highlights and Voices snippets come from user-published source sheets, and
  the sidebar can call every server function, so this was reachable. Only
  inline typography (`b i em strong u s sup sub small big span br p div ul ol li`)
  with `class`/`dir`/`lang` now survives; SVG/MathML and raw-text elements are
  dropped with their content; and the output is re-parsed and must come back
  unchanged, or the caller gets escaped plain text. Footnotes, bold, and RTL
  spans render as before.
- **Session Library: a source-sheet title could end the dialog's inline
  `<script>`** (`</script>` in a title) and inject markup. Server data embedded
  in templates now always goes through `toEmbeddedJson_`, and a test fails if a
  force-printed template variable does not.
- **`setPreferences` only stores known preference keys**, as strings of at
  most 9,000 characters. Previously any caller could write internal state that
  shares the store, including `linker_upload_acknowledged` (which skips the
  privacy confirmation before the first linker upload) and
  `prefs_schema_version`.
- **Removed jQuery UI 1.9.1** from Preferences. Nothing used it, and it carries
  known CVEs that Marketplace security scans flag.
- **Selected document text is no longer written to the execution log.**
  `findReference` logged the reference and the request URL, and via Insert
  Source from Selection the reference is raw document text (hard rule 7). The
  sheet-node debug log now records the node's key names, not its content.
- GitHub Actions are pinned to commit SHAs.

### Linking tab, per-row Link/Insert, insert-from-selection replace (2026-09)

> **Behaviour change for existing users — migration v11.** *Insert Source from
> Selection* replaces the selected citation with the inserted source again, as
> it did before commit `fefe9b9` (2026-05) switched it, without a setting, to
> keeping the selection. The new `insert_from_selection_replace` preference
> (Preferences → Insertion → Insert from Selection) is written as `true` for every
> upgrading user; turn it off to keep the selection and insert below it.

> **Defaults, and how they are kept.** Every Fonts role — title, linked
> title, Hebrew, transliteration, translation — defaults to **Match the
> document**: the font and size of the text where you insert (the paragraph at
> the cursor, or the nearest body-text paragraph above it). Titles are Normal
> text unless you pick a heading. Divine-name substitution is **on**, for יהוה
> only, replaced with **יי**.
>
> **Every user's defaults are now saved on their first run**, whether or not
> the install trigger fired, and a reinstall no longer overwrites saved
> choices. A default changed in a later release therefore reaches new users
> only; anyone already using the add-on keeps what they had. (The menu layout
> is the one exception: left unsaved, it keeps picking up new menu items.)
> Schema steps v12 (a no-op) and v13 (writes the new `source_title_heading`)
> keep the schema number monotonic.

#### Documentation

- **Help & Support rewritten for the current interface.** The dialog described
  controls that no longer exist (a "Text & Links" panel, "Hebrew on top"
  layouts). It now walks through the sidebar as it is — the tabs, result
  tools, Versions and Preview, the 📰 Layout tray, Session Library, Quick
  Actions, Link Texts with Sefaria, divine names, every Preferences tab, the
  Menu Bar, and keyboard shortcuts — with a troubleshooting FAQ, a bug-report
  checklist, and a user-facing *What's new*. `docs/google-docs-walkthrough.md`
  and the README's menu and layout sections were brought into line.
- **Privacy policy: the browser-side sidebar history is now disclosed.** The
  Session Library, recent searches, and recent/starred Lexicon entries live in
  the browser's local storage; §3 said nothing else was stored.

#### Added

- **Preferences → Fonts → Title → Paragraph style.** Inserted titles can be
  Heading 1–6 instead of normal text, so they appear in the document outline
  and table of contents. With a heading, **Match the document** and a blank
  size leave the heading's own font and size showing. Default: Normal text.
- **Match the document** as a font choice (and a blank size) for every Fonts
  tab role.

#### Changed

- **Preferences → Fonts is laid out the same way for every role.**
  Transliteration is its own section instead of a nested dropdown inside
  Hebrew. Title, Hebrew, Transliteration and Translation (in insertion order)
  each have a one-line note, an optional choice row (paragraph style, scheme,
  language), and a Typography card with the same Font / Size / Style row,
  Text colour / Highlight pair, and preview. All four offer the same font list.
- **The יהוה replacement list is יי, ה', יקוק, השם.** ד', ידוד, יהו-ה and יחוח
  were removed; a stored value from those is kept and shows under Other.

#### Fixed

- **Preferences → Source Emphasis: the Text colour and Highlight controls
  overlapped.** The mapping cards reused the font/size/style grid, whose middle
  track is narrower than a colour control. The row now wraps instead.
- **Preferences: dropdowns sat about 20px below their labels.** The hidden
  native `<select>` behind each custom dropdown was made `position: relative`
  again by a broader rule, and its empty line pushed the dropdown down.
- **Preferences: scrolled content showed above and below the tab bar.** The
  intro card and the tab bar were both pinned to the top, so the intro peeked
  out beneath the tabs, and the scroll area's top padding left a strip above
  the tabs where content showed through. Only the tab bar is pinned now, flush
  to the top edge.
- **Preferences → Menu Bar listed Surprise Me while the feature was off.** It
  now appears in the editor only while its switch (Experimental tab) is on, and
  keeps its place in the layout for when it is switched back on.
- **Preferences → Menu Bar had no way to turn an item off.** Each item (and the
  Quick Actions submenu as a whole) now has a checkbox; an unticked item keeps
  its place in the editor but is left out of the add-on menu, and ticking it
  restores it where it was. Stored inside the existing `menu_layout` value as
  an optional `hidden` list — no new preference key, no migration.
- **Link Texts with Sefaria: the review table rendered inside the scanning and
  finished states.** Each dialog state is switched with the `hidden`
  attribute, but the states also set `display: flex`, which overrides it — so
  the scanning bar, the ambiguous-citation table, "Applying links…" and the
  Close button all showed at once, with the table squeezed between them. The
  dialog now shows one state at a time and the table fills the dialog.

#### Changed

- **Link and Insert are separate checkbox columns in the review dialog.** Every
  row can be linked, inserted (the source's text below the paragraph that cites
  it, using your insertion defaults), both, or neither. Header checkboxes set a
  whole column. Ambiguous rows start with neither ticked; choosing a source
  ticks Link. In *Show a summary* mode the single-source matches sit in a
  collapsed group below the ambiguous ones — still linked by default, one click
  away when you want to insert them.
- **New Linking tab in Preferences.** *Document scanning*, *After linking* and
  the privacy note moved there from the Insertion tab.
- **"Enable Source Insertion after Linking" left the Experimental tab.** The
  dialog's Insert column replaces it. The same preference
  (`link_sources_insert_after_linking`) is now **Insert text after linking**,
  shown only when *After linking* is *Just link and report a count*, and makes
  that quiet pass insert each linked source too. No key was added or renamed.

### Preferences cleanup and a customizable menu (2026-09)

#### Added

- **Menu Bar tab in Preferences.** Reorder the add-on's menu, move items into
  or out of the Quick Actions submenu, and add or remove dividers. Preferences
  and Help & Support are fixed at the bottom so the way back to this screen
  can't be lost. Emptying the Quick Actions submenu removes it from the menu.

#### Changed

- **Preference migration (schema 10): `insert_from_selection_at_top` is
  replaced by `menu_layout`.** The old Quick Access toggle could only pin one
  item; it is gone, and the Menu Bar tab covers it. Upgraders who had pinned
  *Insert Source from Selection* keep it pinned at the top of the menu;
  everyone else sees the unchanged default menu. The old key is removed.
- **The Quick Access accordion moved** from the Insertion tab to the new Menu
  Bar tab.
- **Source Emphasis is now the last accordion on the Fonts tab**, and the tab
  opens with Title Typography expanded instead.
- Before the add-on is authorized (`AuthMode.NONE`), the menu now uses the same
  default layout as everyone else; previously *Insert Source from Selection*
  sat inside Quick Actions in that one case.

### Multi-translation insert and Hebrew entity fixes (2026-09)

#### Fixed

- **`&thinsp;` showed up literally in inserted Hebrew.** The entity decoder only
  knew a fixed handful of names; Sefaria uses thin, en and em spaces and bidi
  marks in Hebrew texts. The decoder is now a single table-driven pass covering
  those (and decodes each entity exactly once — `&amp;lt;` used to become `<`).
  Voices/sheet text goes through the same decoder.
- **Multi-translation insert: version named twice in linked titles.** With
  *Insert Sefaria link* on, each title read
  `Genesis 1:1 (Koren) (Translation • Koren)`. It now reads
  `Genesis 1:1 (Translation • Koren)`, and each block's link opens that
  translation on sefaria.org rather than the default one.
- **Multi-translation insert: blocks ran together.** A blank paragraph now
  separates each translation block (after its citation, if shown) from the
  next, and follows the last block.
- **Multi-translation insert: empty translations.** A selected translation
  with no text for the reference is no longer inserted as an empty block — nor
  replaced by a second copy of Sefaria's default translation. The sidebar says
  which were skipped and greys them out as *unavailable for this ref*; a
  translation found empty while previewing is greyed out the same way and the
  preview moves on to the next available one.

### Reference-normalization hardening, and versioning (2026-09)

#### Fixed

A pass over every normalization applied to raw user input, prompted by the
sheva-apostrophe bug. It was not a one-off — the same shape appeared three more
times, each failing silently, each looking like a gap in Sefaria's library
rather than a bug here.

- **Hebrew abbreviations were destroyed.** `normalizeReferenceInput` stripped
  gershayim from anything between two Hebrew letters, so `רמב״ם` (Rambam)
  became `רמבם` and `ב״מ` (Bava Metzia) became `במ` — neither is a word in any
  catalogue. The rule exists for Hebrew *numerals* (`ל״ב` = 32, which does
  resolve bare), and nothing distinguishes a numeral from an abbreviation by
  shape. Stripping is now offered as an **additional candidate** rather than
  imposed on the query, so the faithful form is always tried too.
- **English titles containing a colon or dash were rewritten.**
  `The Torah: A Women's Commentary` became `The Torah:A Women's Commentary`,
  and `Sefer HaChinukh — Introduction` became `Sefer HaChinukh-Introduction`.
  The collapse has a real job — `Genesis 1:1 - 1:5` should tighten to
  `Genesis 1:1-1:5` — so it is now confined to numerals on both sides.
- **`Psalms` was searched for as `Pesalms`.** `applyConsonantClusterVoweling`
  turns `Bshalach` into `Beshalach`, which is the point, but the same rule hits
  ordinary English onsets: `Stone Edition` → `Setone Edition`. It is now a
  **fallback** for the title lookup rather than the query — tried only when the
  reader's own spelling returns nothing, so it can add matches but never lose
  one.

#### Added

- **`docs/VERSION.json`** — single source of truth for the version and the
  preference-schema number, with `test/ui/version-manifest.test.js` enforcing
  it against `migrations.gs`, against the existence of every migration the
  schema claims, and against every user-facing surface that shows a version.
  Apps Script has no version field of its own, so this is a fact the repository
  asserts; a claim nothing checks is a claim that drifts.
- **`docs/versioning.md`** — what bumps what, and the coupling that matters: a
  new preference key needs a default, a migration, a schema bump, a manifest
  bump and a version bump, all in one commit. Includes a section for AI agents.
- **`docs/live-test-checklist-2.0.0.md`** — the manual pass, covering what the
  119 automated tests structurally cannot: sidebar rendering, the CSP, the
  upgrade path, and anything that needs a real `DocumentApp` or a live Sefaria
  request.

### Linker: recover clipped matches, separate the two failure kinds (2026-09)

#### Fixed

- **The pre-filter was discarding matches it could have placed exactly.** When a
  citation ran past the end of its scan window, the mapper dropped it. But
  Sefaria routinely includes trailing whitespace in a citation's character
  range, and the separator joining scan windows *is* whitespace — so in those
  cases the citation sat entirely inside one window and was recoverable. The
  mapper now clamps the overrun to the window boundary and places the link.
  Only an overrun that reaches real text in a *later* window is refused, and
  that refusal is correct: such a "match" is text stitched together from two
  non-adjacent parts of the document, so no contiguous span of the document
  contains it and linking it would hyperlink the wrong words.

#### Changed

- **"Could not be placed" is now reported separately from "could not be
  resolved."** They are different problems with different remedies:
  *unresolved* means Sefaria could not identify the source, and *unplaceable*
  means the citation was recognised but fell across a gap in the partial scan.
  Only the second has an action the reader can take, so the message now names
  it: switch **Document scanning** to **Whole document**. Lumping them together
  hid an actionable failure inside an unactionable count.

#### A note on why these are not offered in the review table

An unplaceable match has no document text to hyperlink — that is precisely what
makes it unplaceable. Putting it in the review table would ask the reader to
choose a destination for a phrase that does not exist anywhere in their
document as written. Counting it and naming the remedy is the useful answer.

### Linker review and ambiguity resolution (2026-09)

#### Added

- **"Link Texts with Sefaria" now shows what it is doing and asks when it isn't
  sure.** The command opens a dialog immediately, so a multi-second scan shows a
  progress state instead of only Google's generic "running script" toast. When
  the scan finishes it presents a three-column review: a checkbox, the exact
  words in your document that will become the hyperlink, and the Sefaria
  reference it will point to — as a dropdown whenever there is more than one
  candidate, each with the reference's Hebrew title and an excerpt so you can
  tell them apart before applying anything.
- **New `linker_review_mode` preference** (Preferences → Privacy & Document
  Scanning → *After linking*):
  - **Show a summary, and ask about ambiguous citations** (default) — links
    everything unambiguous automatically, and only asks about genuine ties.
  - **Show every match for review** — lists them all before anything is applied.
  - **Just link and report a count** — never interrupts; skips ambiguous
    citations rather than guessing.

#### Fixed

- **Ambiguous citations were resolved silently, to an arbitrary destination.**
  The previous code took `refs[0]` for every match. Sefaria returns those
  candidates *unranked* — `is_ambiguous` is binary, with no confidence score —
  so "the first one" was not a best guess, it was the first item in a list.
  Ambiguous citations are now surfaced rather than guessed at, and the candidate
  order shown is Sefaria's own, with no ranking invented on top.
- **Unresolvable citations vanished without a word.** "Linked 4 references" was
  the entire report whether 4 or 40 citations had been found. Every category
  that cannot become a link — unresolvable, out-of-range, or straddling two
  pre-filter windows — is now counted and reported.

#### Changed

- Existing users are migrated to `summary` (schema v9). This changes behaviour
  deliberately: the published add-on's silent first-candidate pick presented an
  arbitrary choice as a result. `summary` keeps every unambiguous link
  automatic, so the interruption is proportional to the actual uncertainty;
  **Just link and report a count** restores the non-interactive flow, now with
  honest counts.
- `/api/find-refs` is called with `with_text=1&max_segments=1`, so candidate
  excerpts arrive in the same request — the preview costs no extra round-trip.
- `findRefsInDocumentText` returns `{results, refData}` rather than a bare
  results array.
- New RPCs `scanDocumentForReferences` (read-only) and `applyLinkerDecisions`,
  registered in `docs/rpc-surface.json`. Splitting scan from apply is what
  allows the dialog to open before the work starts.

### Traditional citation forms (2026-09)

#### Added

- **Traditional Hebrew citation abbreviations now resolve.** "Hil. Shabbat 1:1"
  is how people cite Rambam; Sefaria indexes that section as "Mishneh Torah,
  Hilchot Shabbat" — so the literal string resolved to nothing and the failure
  read as "Sefaria doesn't have it". `server/citation-abbreviations.gs` now
  offers the indexed forms as additional lookup candidates, covering the 81
  Mishneh Torah sections Sefaria registers under a `Hilchot X` title. Accepts
  `Hil.`, `Hil`, `Hilchos`, `Hilkhot` and friends, and canonicalizes in place
  when the reader already named the work ("Rambam, Hil. Teshuvah 3:4").
- **A partial-overlap pass for suggestions**, used only when the exact and
  all-tokens passes both come back empty. This is what rescues "Hil. Avodah
  Zarah 12:11": Sefaria files that section as "Mishneh Torah, Hilchot Avodah
  **Kochavim**", so "Zarah" can never match and no amount of string
  normalization will find it — but "Hilchot" and "Avodah" do, which is enough to
  offer the section and let the reader decide.

#### Changed

- Suggestion ranking weights matches by **characters** rather than token count.
  "Hilchot Avodah Zarah" matches two tokens against both *Avodah Zarah* (the
  Talmud tractate) and *Mishneh Torah, Hilchot Avodah Kochavim*. Counting tokens
  equally ranked the tractate first — the wrong work. Weighting by length lets
  "Hilchot", the word that says which work this is, outweigh the shorter
  "Zarah".
- A section registered under several work names is offered once, under the name
  Sefaria displays when you open it ("Mishneh Torah, …" rather than
  "Rambam, …"), so the suggestion matches where the reader lands.

#### A note on what is deliberately NOT done

Expansions may only **add** words, never drop them. "Hil. Avodah Zarah" must not
become "Avodah Zarah", because that is a real Sefaria title — the Talmud
tractate — and rewriting the query would resolve confidently to the wrong work.
Queries that cannot be expanded safely fall through to suggestions instead. A
confident wrong answer is worse than no answer.

### JQuery upgrade (2026-09)

#### Security

- **jQuery upgraded from 1.9.1 (2013) to 3.7.1, pinned with Subresource
  Integrity** and loaded over an explicit `https://` rather than a
  protocol-relative URL. 1.9.1 carries known XSS-relevant advisories, and it is
  the code interpreting every `$(...).html()` call in the add-on — jQuery's
  `.html()` executes script elements in the markup it is handed, which plain
  `innerHTML` does not, so the version implementing it matters more than the
  call count alone suggests.
- The integrity hash was computed from the bytes `ajax.googleapis.com` actually
  serves rather than copied from a published list, and CORS was confirmed
  (`Access-Control-Allow-Origin: *`) so SRI can be enforced. **If the hash is
  wrong, jQuery does not load and the sidebar is inert** — re-verify it, never
  guess it, when bumping the version.

#### Migration notes

The codebase was audited for APIs removed between 1.9 and 3.x — `.andSelf`,
`.size`, `.live`/`.die`, the `.load`/`.unload`/`.error` shorthands,
`$.browser`, two-argument `.toggle` — and none were in use. The single
`:visible` selector (`shared/composition-card/shared.html`) is safe: jQuery 3
widened that test rather than narrowing it, and the element it guards is a
`<div>` with initial text, so it always has a layout box.

**This one wants a real sidebar before the Marketplace push.** The audit is
static; a 14-year version jump deserves the sidebar, preferences dialog, and
Voices/Lexicon tabs each opened once. It is deliberately its own commit so it
can be reverted independently of the sanitizer and CSP work.

### Preview hardening (2026-09)

#### Security

- **Sefaria HTML is stripped of subresource-loading markup before it is
  rendered.** Sefaria bleaches text records on save, so event handlers and
  `javascript:` URLs cannot reach the add-on — but their allowlist does permit
  `<img src>` and `<a href>`. A text naming a third-party host would make the
  reader's browser fetch it, leaking an IP and the fact that a particular
  passage was opened. New `sanitizeSourceHtml()` removes elements that fetch a
  subresource or execute, unwraps anchors (keeping their words), keeps an
  `<img alt>` as text, and strips `on*` and URL-bearing attributes. It is a
  strip, not an allowlist: `b`, `i`, `em`, `strong`, `sup`, `sub`, `span`,
  `br`, and the `class`/`dir` attributes that footnotes and RTL runs depend on
  all pass through untouched.
- Applied at the three places raw Sefaria HTML reached the DOM: the text
  preview, the Elasticsearch highlight snippets in the results list, and
  `extractTextFromHtml_`.
- **`extractTextFromHtml_` was making a network request.** It assigned
  untrusted markup to a detached `<div>`'s `innerHTML` to read its plain text —
  and a detached div still causes the browser to fetch any `<img src>` in the
  markup. It now parses into an inert `DOMParser` document.
- **Content Security Policy** added to the shared head partial, restricting
  `img-src` to sefaria.org, the-merkaz.org and Google's own hosts, plus
  `object-src 'none'` and `base-uri 'self'`. It deliberately does **not** set
  `default-src` or `script-src`: HtmlService injects its own bootstrap and the
  `google.script.run` bridge, and a script-src that missed one of them would
  silently break the server bridge rather than fail loudly. This is the backstop
  for any render path added later that forgets to sanitize.

### Formatting control and search recovery (2026-08)

#### Added

- **Text colour and highlight for every insertion role.** Hebrew, translation,
  transliteration, source title and hyperlink each gain a colour and a
  highlight control in Preferences → Fonts. Both default to *unset*, meaning
  "leave the document's own formatting alone" — a native colour input cannot
  express that, so the state is carried alongside the picker and shown as a
  muted field with an **Auto** / **None** button. Defaulting these to
  `#000000` would have silently restyled every existing user's documents,
  including anyone working in a themed or dark document.
- **Advanced: map the source's emphasis to your own formatting**
  (Preferences → Source Emphasis). Sefaria's bold and italic no longer have to
  render as bold and italic. Each channel maps independently to any
  combination of bold / italic / underline, a text colour, a highlight, and a
  font override — so the Steinsaltz Talmud's bolding can come through as, say,
  blue text if that matches your document's conventions. Turning every option
  off in a card drops that emphasis entirely. Defaults are the identity
  mapping, so nothing changes until you touch it.
- **Zero-result searches now suggest related catalogue entries.** Searching
  something the library does not match exactly offers up to five real titles
  to click, instead of an empty panel. When nothing is close enough to
  suggest, the panel says so and names the query shapes that work rather than
  rendering blank.

#### Fixed

- **"Did you mean" never fired for a fragment from the middle of a title.**
  The suggester only considered titles beginning with the same letter as the
  query — right for typos, useless for fragments. Searching *A Woman's
  Commentary* offered nothing, because the catalogue entry is *The Torah: A
  Women's Commentary*: different first letter, and one letter different in the
  token that matters. A second token-overlap pass now matches titles
  containing every significant word of the query, tolerating a one-character
  difference per token and ignoring stopwords. Suggestions remain suggestions —
  they are never auto-selected.

#### Changed

- All typography now flows through a role-based helper
  (`applyRoleTypography_`), so colour and background reach every insertion
  path — texts, source sheets and lexicon entries alike — rather than only the
  ones that happened to be updated. `getTypographySettings()` gained a `roles`
  map; the previous flat keys are kept as aliases.
- Suggestion cap raised from 3 to 5.

### Privacy, emphasis, and search fixes (2026-08)

#### Added

- **Privacy policy** (`docs/PRIVACY.md`), linked from Preferences and from
  Help & Support → About. Documents every scope, everything sent to Sefaria,
  and the fact that the add-on has no server, no analytics, and no account.
- **Preferences → Privacy & Document Scanning.** New `linker_scan_mode`
  setting controlling how much of your document "Link Texts with Sefaria"
  uploads.
- **Client-side linker pre-filter** (`apps-script/server/linker-prefilter.gs`).
  The document is now scanned locally first; only passages that could contain
  a citation — a known Sefaria book title, a chapter:verse number, a Talmudic
  daf, or a Hebrew abbreviation — are uploaded, with padding for context.
  Prose containing no citation never leaves the document.
- **First-run disclosure** before "Link Texts with Sefaria" uploads anything,
  naming which scan mode is active. Shown once, then remembered.
- **Preferences → Source Emphasis** toggle (`preserve_source_emphasis`).

#### Fixed

- **Search returned nothing for titles containing an apostrophe.**
  `expandShevaApostrophe` rewrote every consonant-apostrophe pair, so
  "A Woman's Commentary" was searched for as "A Womanes Commentary" — and the
  same mangled string was used for the /api/name lookup, the direct-reference
  resolve and the content search, so all three failed at once. The rule now
  only fires on a word-initial 1-2 consonant cluster, which is the only shape
  a transliterated sheva takes. "P'sukei D'Zimra" → "Pesukei DeZimra" still
  works; "Jacob's Ladder" and "don't" are left alone.
- **Inserted text lost the source's bold and italics.**
  `applyTypographyToParagraph` blanket-cleared bold/italic across the whole
  paragraph right after `insertRichTextFromHTML` had set it per-run from
  Sefaria's markup. This destroyed, among others, the Steinsaltz Talmud's
  bolding of the Talmud's own words against Steinsaltz's interpolated
  explanation. Emphasis is now captured before the baseline style is applied
  and re-asserted after it, so your font-style preference sets the baseline
  and the source's emphasis layers on top. Titles and metadata lines
  deliberately do not preserve — their emphasis is the add-on's, not the
  source's.
- Text following an unclosed `<b>`/`<i>` in Sefaria markup no longer loses its
  emphasis (`insertRichTextFromHTML` forced the trailing run to un-emphasized
  instead of using the live state).
- Hebrew single-language insertion applied `nullStyle` (which carries
  `BOLD=false`) *after* the text was inserted, unlike every other body path.
  Moved to the empty paragraph, matching the others.
- **No size guard on the linker upload.** A document over 100,000 characters
  silently timed out and reported "0 references". It now fails with an
  explicit message naming the limit.

#### Changed — read this one

- **"Link Texts with Sefaria" no longer uploads your whole document by
  default.** Existing users are migrated to `linker_scan_mode: "candidates"`
  (schema v7). This is a deliberate privacy decision, not a new feature gate:
  the whole-document upload was never disclosed to users. The trade-off is
  slightly lower recall on unusual citation forms the local scan does not
  recognize. **Preferences → Privacy & Document Scanning → Whole document**
  restores the previous behavior exactly.
- `preserve_source_emphasis` defaults to `true` and is migrated ON for
  existing users (schema v6), because the previous flattening was a bug rather
  than a preference.
- CI deploy workflow (`.github/workflows/deploy.yml`) rebuilt: the job is now
  gated on `github.repository`, so a fork — including an upstream maintainer
  merging from this one — never attempts to deploy into this fork's Apps
  Script project. It also runs `npm test` and `pre_clasp_qc.sh` in a separate
  `verify` job before the deploy job runs, pins `@google/clasp` (the token
  conversion targets clasp 2.x, and "latest" silently moved to 3.x), passes
  the token via `env:`, adds a concurrency group, and fails with a clear
  message when `CLASP_TOKEN` is unset. The stale personal branch trigger is
  gone; `workflow_dispatch` replaces it.
- `test/tests/migrations.test.js` reads `PREFS_SCHEMA_CURRENT_` from the
  source instead of hardcoding it in five assertions.

### Pre-upstream review pass (2026-08)

A safety/sanity review ahead of proposing this fork upstream. No feature
changes; the Sefaria API surface, OAuth scopes, and a full code review are
summarized in `docs/pre-upstream-review.md`.

#### Fixed

- `releaseNotesPopup()` called `SpreadsheetApp.getUi()` in a Docs-only add-on.
  Dead code today (nothing calls it), but it would have thrown on first use and
  is the only reference in the project that could cause a Sheets OAuth scope to
  be inferred. Now `DocumentApp.getUi()`.
- Enabling **Pin "Insert from Selection" at top of menu** showed the menu item
  twice; the unconditional copy is now suppressed when the item is pinned.
- `htmlToPlainText_()` (source-sheet rendering) decoded HTML entities *before*
  stripping tags, so an escaped `a &lt; b` decoded to `a < b` and was then eaten
  by the tag-stripper. Tags are stripped first now, and `&amp;` is decoded last
  so `&amp;lt;` no longer double-decodes.
- `formatDataForPesukim()` read `data["sections"][1]` unguarded and threw on
  resolved payloads that carry no `sections` (dictionary entries, some complex
  book-level refs). `insertion.gs` already guarded the same read.
- `onInstall` seeded preferences from a second, drifted copy of the defaults —
  it omitted ~14 keys and disagreed with `getDefaultPreferences()` on the
  translation and transliteration font sizes. It now derives from
  `getDefaultPreferences()` plus an explicit `getFreshInstallPreferenceOverrides_()`
  (divine-name substitution stays ON for new installs), and stamps
  `prefs_schema_version` so a new install does not re-run every migration.
  **Note:** new installs now get 12pt translation/transliteration text instead
  of 11pt. Existing users are unaffected.
- `experimental_features_enabled` is listed in `SETTINGS` and read by the
  sidebar but had no entry in `getDefaultPreferences()`, so it resolved to
  `undefined`. Added with an explicit `false`.
- `test/ui/snapshots/preferences.html.snap` was stale (hand-edited rather than
  regenerated), leaving `npm test` red on the branch. The Hebrew preview string
  in `preferences.html` was also accidentally de-normalized away from NFC;
  restored, and the snapshot regenerated.

#### Changed

- `runUserPreferenceMigrationsIfNeeded_()` now compares the stored schema
  version numerically (`from < N`) instead of chaining `current !== 'N'`
  guards. The old form worked but required editing two conditions per new
  version and would re-run the newest migration for any version above it.

#### Security

- Source-sheet content is third-party user-generated data (anyone can publish a
  Sefaria sheet). Media-node URLs and the sheet URL were written into the user's
  document as live hyperlinks with no scheme check. Both now go through
  `safeLinkUrl_()`, which allows only `http:`, `https:` and `mailto:` and
  rejects values containing control characters. Non-linkable values still render
  as visible text.
- `parseSefariaUrlInput()` accepted any hostname *containing* `sefaria.org`,
  including `sefaria.org.evil.example`. It now requires the host to be
  `sefaria.org` or a true subdomain, over http/https only.
- `pre_clasp_qc.sh` gained check **9b**: jQuery `$(sel).html(x)` is the same
  sink as `.innerHTML =` but check 9 never saw it. 9b applies the same
  justification-comment standard to dynamic `.html()` writes. It reports at WARN
  (16 pre-existing sites) so CI stays green while the count is burned down.

## Cleanup pass (2026-04)

> Called "v1.0" internally at the time; never a published version. *Version
> 1.0* now means Sefaria for Google Docs 1.0, the Marketplace add-on this one
> follows.

Everything below is grouped under the one-shot cleanup that brought the rewrite branch to a shippable state. The eight stages were individually commits; see `git log --grep='^Stage '` for the commit history.

### Added (guardrails and contracts)

- `AGENTS.md` / `CLAUDE.md` at the repo root — hard rules, known regression traps, and scope fence for future contributors (human or AI).
- `docs/regression-log.md` — dated table of bugs that regressed silently, each with the pinning test that now holds it down.
- `docs/architecture.md` — server/client boundary, storage layers, include graph, guardrail inventory.
- `docs/rpc-surface.json` + `test/ui/rpc-surface.test.js` — frozen list of every `google.script.run.X` target, enforced in both directions.
- `test/ui/contracts/sidebar-bootstrap.schema.json` + `test/ui/sidebar-bootstrap-shape.test.js` — shape contract for `getSidebarBootstrapData`. The sidebar also validates the shape at load time and logs a structured `console.warn` on mismatch.
- `apps-script/migrations.gs` — schema-versioned user-preference migrations (v2 restores divine-name substitution for upgraders; v3 scrubs detached-AI state).
- `.github/workflows/test.yml` — `npm test` + `pre_clasp_qc.sh apps-script` on every push.
- `pre_clasp_qc.sh` — now walks the nested `apps-script/` tree, is include-graph-aware for duplicate-function detection, and FAILs on `.innerHTML` writes without a justification comment.
- `docs/ai-lesson/DESIGN.md` + `reference/ai-lesson/` — preserved design for the deferred AI lesson feature, with the Merkaz / CacheService / Sefaria-hosted routes documented.

### Fixed (silent regressions, each with a pinning test)

- Divine-name substitution silently stopped applying on insert for upgrading users (`apply_sheimot_on_insertion` was added defaulting to `false`). v2 migration restores it.
- `extendedGemaraPreference` module-scope global set but only read on sidebar-open paths; Quick Actions menu callers saw stale `false`. Reads the preference at call time now.
- `formatDataForPesukim` appended `\n` between verses even when line markers were off, turning prose into paragraph-break-per-verse. Restored original space-joined prose.
- "Refresh Sidebar" button in preferences called a server function that did not exist; click silently no-opped. Binding restored.

### Changed (ergonomics and structure)

- `insertReference` replaced its 9-positional-parameter signature with a named-options bag: `insertReference(data, opts)`. The 350-line body is unchanged.
- Hebrew and English divine-name helpers unified behind one config-driven `applyDivineNameReplacements(data, userProperties, options)`; the two legacy entry points remain as thin wrappers.
- Code.gs domain split (menu / preferences / sefaria-fetch / text-processing / insertion / search / sheets) deferred to a follow-up pass; see `docs/architecture.md` § Follow-up.
- CSS token drift cleaned up: hardcoded `#18345d`, `#22426f`, `#ddeeff`, `#445267` in CSS partials now reference `var(--sefaria-blue)`, `var(--selected)`, `var(--selected-hover)`, `var(--selected-soft)`, `var(--footer-button-text)` from `apps-script/css/tokens.html`. Entry templates were already inline-style-free.

### Removed

- Cross-project Review Schema / ProvenanceRecord / Living Library / Commentary Builder / GOLEM pollution from README, CHANGELOG, and tests.
- `testRef()` debug function and a commented-out `/* ---- test harness --- */` block inside `insertReference`.
- AI lesson generator from the shipped add-on; preserved under `reference/ai-lesson/`. The `userinfo.email` OAuth scope is dropped with it.

### Security

- Every `.innerHTML =` write now either uses `textContent` + `document.createElement` (preferred) or has an adjacent justification comment; pre-clasp QC FAILs unannotated writes.
- Every `<a target="_blank">` in shipped HTML has `rel="noopener noreferrer"`.
- `Logger.log` call sites audited; no `UserProperties`, credentials, or raw document text reaches the log.

### Deferred

- Hebrew misspelling tolerance (valid Hebrew-script refs are supported; typo correction is not implemented).
- AI lesson generator (see `docs/ai-lesson/DESIGN.md` for the full rationale and the Sefaria-hosted route recommendation).
- Code.gs domain split (see `docs/architecture.md` for the starting-order checklist).

## Pre-cleanup — Fork enhancements

### Added
- Unified **Find & Insert Source** sidebar replacing the older split insertion/search workflow.
- Grouped results with **Library matches** first and **Search results** second.
- Explicit **select -> preview -> insert** flow instead of click-to-insert search behavior.
- Sefaria-style display controls:
  - Source
  - Translation
  - Source with Translation
- Bilingual layout options:
  - Hebrew on top
  - Hebrew left
  - Hebrew right
- Visible Hebrew formatting controls:
  - Vowels
  - Cantillation
- Translation details / attribution controls for inserted translation content.
- Typography preferences:
  - Hebrew font
  - Hebrew font size
  - Translation font
  - Translation font size
- English divine-name replacement preference (`God` -> `G-d`).
- Sidebar actions:
  - Insert Sefaria link
  - Open on Sefaria
  - Open divine name preferences
- Document-wide **Link Texts with Sefaria** menu action.
- Preference-gated Popcorn availability.
- Local lightweight attribution tests.

### Changed
- Refactored the main insertion/search UX into a single unified sidebar.
- Improved translation version selection and long-title handling.
- Improved nested/breadcrumb-style display in results and preview.
- Improved handling of structural/non-leaf nodes with clearer non-insertable messaging.
- Improved language label normalization for translations, including lightweight suffix-based fallback.
- Updated menu structure to emphasize the unified workflow.
- Updated release/documentation text to reflect the expanded scope of the add-on.
- Updated divine-name workflows across insertion-time transforms and menu-driven document transformations.

### Fixed
- Search result click-target issues.
- Silent insert failure when text was selected in the Google Doc.
- Translation selector interaction reliability.
- Result overflow/wrapping issues.
- Preferences scrolling/layout issues.
- Divine-name transformation handling for marked Hebrew forms.
- Multiple regressions discovered during manual QA across unified search, insertion, preview, and preferences.

### Deferred
- Hebrew misspelling tolerance remains deferred; valid Hebrew-script refs are supported, but typo correction is not yet implemented.
