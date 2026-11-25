# Live test checklist — v2.0.0

Run this in a real Google Doc against HEAD — after `clasp push`, installed via
Apps Script → Deploy → Test deployments — before creating the release version
and pointing the Marketplace SDK at it. Everything here is something the
automated suite **cannot** reach: `npm test` covers logic, contracts and
snapshots, and every page has been loaded in headless Chromium without script
errors, but nothing automated holds a `DocumentApp` handle or makes a request
to Sefaria.

**Version under test:** 2.0.0 · **preference schema:** 30 (both from
`docs/VERSION.json`)
Confirm both before starting — *Help & Support → About* should read
**Current line: 2.0**. If it says anything else, the push did not land.

It asks whether each change in the v2.0.0 changelog entry landed.
[`walkthroughs/1-stress-test.md`](walkthroughs/1-stress-test.md) goes further,
with the odd cursor positions, slow networks and accidents a real user will
eventually hit; run it once this checklist passes. Check ids are a letter and a
number (C4, J14) so they can't be mistaken for a version.

Three accounts' worth of setup matters, because most of the risk is in what
a user has before they open 2.0.0:

- **Account A — upgrading tester.** Had a development build of this add-on
  with preferences they changed: a font, a divine-name rule, a layout. Do **not** reset
  preferences. This is the account that proves the migrations (schemas up to
  30) keep what users chose. Take a screenshot of Preferences before the push.
- **Account B — fresh install.** A Google account that has never had the
  add-on. Proves `onInstall` seeds correctly, builds the menu and shows the
  first-run setup. Resetting preferences on Account A is *not* a substitute:
  it does not run `onInstall`.
- **Account C — version 1.0 user.** Has the published
  *Sefaria for Google Docs* 1.0 installed, and a document it inserted sources
  into. That add-on stores no settings, so C meets this one as a new user. Most
  Marketplace users will take this path.

A test document with a few paragraphs of prose, a two-cell table, a header and
a footnote serves every section below.

---

## A. Install and first open — accounts B and C

| # | Check | Expected |
| --- | --- | --- |
| A1 | **B:** install the test deployment from a Doc, then open **Extensions** *without reloading* | The add-on's menu is already there, and the first-run setup opened (*Step 1 of 3*), not the release notes. (Marketplace reviewers check this first.) |
| A2 | **B:** click **Continue** through all three screens without changing anything | Setup closes behind a *Saving…* spinner. Preferences shows the defaults: colours **Auto / None**, Divine Name Mappings יהוה → יי on, Linking **Candidate passages only**, Interface **Everything** |
| A3 | **B:** *Help & Support → Quick start → Run setup again*, then **Skip for now**; reload the document | Setup reopens, then closes with nothing changed. After the reload it is not shown again on its own |
| A4 | **C:** install; open the document version 1.0 inserted into; open **Extensions** | Two *Sefaria for Google Docs* submenus (the published 1.0 and this build), each with its own items; the first-run setup opens once |
| A5 | **C:** on screen 1 choose **I've used Sefaria for Google Docs**; continue | Screens 2 and 3 start on both languages, Hebrew on the right, and Simple; a note under *God's name* says the name is now replaced as sources go in |
| A6 | **C:** insert `Genesis 1:1` with the defaults | A two-column table, Hebrew on the right; יהוה replaced with יי; a small credit line under it |
| A7 | **C:** *Help & Support →* **Coming from version 1.0** | In the Help navigation and on Quick start; every link in it lands |
| A8 | **C:** run **Transform Divine Names**, **Link Texts with Sefaria** and **Unlink Sources** on the text version 1.0 inserted | Each works on it like any other text; Unlink removes its sefaria.org links too |

---

## B. Smoke and Content Security Policy

| # | Check | Expected |
| --- | --- | --- |
| B1 | Open the add-on menu (Everything) | **Texts / Voices / Lexicon / Insert Source from Selection / Quick Actions** (Quick Actions Sidebar, Transform Divine Names, Link Texts with Sefaria, Unlink Sources, Gematriya Count), then **Preferences** and **Help & Support**, last |
| B2 | Open the sidebar | Renders fully — not a blank or half-styled panel. Texts / Voices / Lexicon under the search box; **Add Source**, **📰 Insertion Options** and the 📜 🏃 ⚙︎ footer buttons |
| B3 | Type a query and press Enter | *Searching Sefaria…* with the magnifier while it runs, then results |
| B4 | Sidebar footer | The Sefaria logo renders |
| B5 | Insert a source | The loading card (the Sefarrow inside a spinning ring, *Inserting into your document…*) dims the sidebar; no broken-image icon |
| B6 | A Texts result row, and a selected Voices sheet | The Sefarrow "open on Sefaria" icon renders, crisp, with no white box behind it (it is bundled, so it loads from nowhere) |
| B7 | Open **Help**, **Feedback**, **Release Notes** (*Help → About → What's new*), **Gematriya Count**, **Link Texts with Sefaria**, the **Session Library** window, **Surprise Me** and the first-run setup (*Run setup again*) | Each renders fully; Feedback shows the embedded form. Every one carries the shared CSP |
| B8 | 📰 Insertion Options → Source → **Text font** → David Libre | The Hebrew sample redraws in David Libre (the font loads from Google Fonts) |

> **B2 and B3 are the jQuery 3.7.1 canary.** jQuery is loaded with Subresource
> Integrity — if the hash is wrong the script does not load *at all* and every
> interactive element is dead. A blank sidebar or a search box that does
> nothing means jQuery, not your query. Check the browser console for an
> integrity error before debugging anything else.
>
> A missing image in B4–B7 means the `img-src` list in
> `apps-script/shared/ui/head.html` is short a host (`test/ui/csp-coverage.test.js`
> keeps every page's copy identical). The browser console names it.

---

## C. Upgrade path — account A only

The most consequential and least reversible part of this release. Compare
against the screenshot taken before the push.

| # | Check | Expected |
| --- | --- | --- |
| C1 | *Help & Support → About* | **Current line: 2.0**; *New in 2.0* |
| C2 | Open a document | No first-run setup. Interface **Everything**; the menu is the one you had |
| C3 | Preferences → Insertion: each **Title font** / **Text font** button, and the transliteration's **Font** | Your previous fonts, sizes and styles; colours and highlights **Auto / None** unless you set one — *not* black |
| C4 | Translation → **Commentary** | Your old choice under its new name: Keep → **Default**, Drop → **Combine**, Bold only → **Drop** |
| C5 | Source → **Vowels** and **Cantillation** | Vowels on → **On**; *Vowels only in Tanakh* → **Tanakh**; Cantillation on → **Tanakh**. A Tanakh insert looks as it did |
| C6 | Both **Link title to Sefaria** switches; a linked title in an insert | Each as your old single switch was; a linked title still names its edition (*Genesis 1:1 (Translation • …)*) and keeps the linked style |
| C7 | Insert any source | The credit block is on or off exactly as before; it is 8 pt italic in the font of the text above (Layout → **Citation style**) |
| C8 | Layout → **Line by line**; Transliteration → **Position**; **Punctuation** in both sections | Line by line as you left it; Position **Below**; Punctuation on in both. A side-by-side insert looks as before |
| C9 | Preferences → **Linking** | *Document scanning* and *After linking* as you left them (**Candidate passages only** and **Show a summary…** if you never changed them) |
| C10 | **Divine Name Mappings** | Your replacements unchanged; a custom one reopens under its own label, not *יי* or *G-d* |
| C11 | Preferences → **Search** | Every corpus, Voices topic, Lexicon dictionary and translation language shown, nothing hidden; *Show unavailable translations* off |
| C12 | Preferences → **Sidebar**; the sidebar | Every tab, Quick Actions button and Insertion Options control on and shown; no profiles until you make one |
| C13 | 📜 Session Library | Your ⭐ starred Lexicon words are pins now, once, after the pins you had; the ⭐ list is gone |

> **C3 is the one to look hardest at.** Colour defaults to *unset*. If any
> field shows a solid black swatch instead of the muted Auto state, a migration
> wrote `#000000` somewhere and every insertion from now on will force black
> text — including in dark or themed documents.

---

## D. Interface and settings

| # | Check | Expected |
| --- | --- | --- |
| D1 | Preferences → **Interface: Simple**, with the sidebar open | At once, without Save or a refresh: the menu is Texts, Insert Source from Selection, Transform Divine Names, Link Texts with Sefaria, then Preferences and Help & Support; the sidebar loses the result sort, ⤦ Restore Corpus and 🧪 (tabs, Add Source, Insertion Options and the footer stay); Preferences hides Search, Linking, Advanced and 🧪 Experimental |
| D2 | Back to **Everything** | Your own menu returns; no setting changed; values not yet saved (and Menu Bar edits) are still there |
| D3 | Preferences → **Sidebar**: switch off **Lexicon** and one Quick Actions button; Save | The sidebar loses the Lexicon tab and that button. *Menu → Lexicon* still opens it, and the tab shows while it is open |
| D4 | Sidebar tab (Everything): switch off Insertion Options' **Punctuation**; Save | Gone from the sidebar's Insertion Options; still in Preferences and Link Texts; inserts use the saved value |
| D5 | **Menu Bar**: **Move to Quick Actions ▸** on Lexicon, then **◂ Move to main menu**; untick an item; Save; reload | Lexicon goes to the end of Quick Actions, then back just below it; the unticked item is gone; Preferences and Help & Support last |
| D6 | **Profiles** (Everything): **+ New profile**; change Vowels in it; Save; click the first profile | The first new one turns your settings into *My settings*; switching asks about unsaved changes first; each profile keeps its own Vowels. With two, the sidebar's Insertion Options names the profile in use and has a *Profile* list; switching there drops the session's Insertion Options changes |
| D7 | **Advanced**: name it *Test*, **Export settings file**; change Vowels and the Hebrew font, Save; import the file, ticking only *Text and layout* | A `.json` download (if blocked, the text to copy). The import preview lists what each part would change; only Vowels comes back, the font stays |
| D8 | Import `{"format":"torah-library-settings","formatVersion":1,"prefsSchemaVersion":"99","settings":{}}` | "made by a newer version"; nothing changes |
| D9 | **Reset To Defaults** | Every setting back to its default, colours Auto, יהוה → יי on; the interface kept, with the menu for it |
| D10 | **🔁 Refresh** | *Refreshing the sidebar…*; the sidebar reopens from saved defaults |
| D11 | ⚙︎ in the sidebar footer, three times quickly | *Opening Preferences…* over the sidebar; one Preferences dialog |
| D12 | With a source selected in the sidebar, change a font and Vowels in Preferences; **Save Defaults** | *Saving preferences…*; the open sidebar's Insertion Options and preview follow at once |

---

## E. Search

| # | Check | Expected |
| --- | --- | --- |
| E1 | `A Woman's Commentary` | Results, or suggestions offering *The Torah: A Women's Commentary* — **not** a blank panel |
| E2 | `Jacob's Ladder`, `don't` | Not mangled; no zero-result dead end from the apostrophe |
| E3 | `Psalms 23` | Resolves. **Not** "Pesalms" |
| E4 | `Hil. Shabbat 1:1` | Resolves to *Mishneh Torah, Hilchot Shabbat 1:1* |
| E5 | `Hil. Avodah Zarah 12:11` | Suggests *Mishneh Torah, Hilchot Avodah Kochavim* **first**; the Talmud tractate also offered, lower |
| E6 | `רמב״ם` (with gershayim) | Resolves or suggests — **not** silently nothing |
| E7 | `בראשית א׳:א׳` | Resolves |
| E8 | `qqqq zzzz` | An explicit "no results" message naming what to try — not a blank panel |
| E9 | `The Torah, A Women's Commentary, Deuteronomy 29:9-14` | Resolves: titles are matched by their words, not their punctuation |
| E10 | `Genisis 1:1` | *Close matches* lists Genesis 1:1, keeping the chapter and verse; nothing opens by itself |
| E11 | `Mishneh Torah` | Not listed as a direct match; a note under the search box says what to add |
| E12 | A footnoted text's **preview** — Rashi on Genesis 1:1, and a Steinsaltz Talmud page | Bold/italic/footnote markers render; no visible tags, and nothing missing compared with sefaria.org. **This is the check for the sanitizer**, which keeps only a fixed set of formatting tags |
| E13 | A phrase search, e.g. `in the beginning` | Results appear (Sefaria's `/api/search-wrapper/es8` route) |
| E14 | Preferences → Search: move Talmud above Tanakh, hide Midrash; search `shabbat` | Groups in that order, no Midrash; ⤦ Restore Corpus shows it marked *(Preferences)* |
| E15 | Texts: type `shalom`, press Enter; switch to Voices, then Lexicon, then back | Each tab's badge counts its results; switching never searches again, the box keeps its text, and Texts comes back with its selection and preview |
| E16 | Texts: `Genesis 1:1`, Enter; switch to Lexicon | Not looked up in the Lexicon, and no stale *No lexicon entries found for 'Genesis 1:1'* message |
| E17 | ⌨︎ Hebrew keyboard; then <kbd>/</kbd>, <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> | Types Hebrew, with a vowels row; / jumps to the search box, the arrows move through results, Ctrl/⌘ + Enter adds the source |

> E1–E7 are normalization bugs that each failed *silently* before — the query
> returned nothing and looked like a gap in Sefaria's library. If any returns an
> empty panel with no message, that is the bug class recurring.

---

## F. Previewing, versions and inserting

| # | Check | Expected |
| --- | --- | --- |
| F1 | Click a result | It previews; nothing goes into the document until **Add Source** |
| F2 | Search `shema`, pick Deuteronomy 6:4, insert | Titled *Deuteronomy 6:4*, not "shema" |
| F3 | Display **Translation**; click different translations, then Ctrl/Cmd-click nonadjacent translations to add/remove them; Shift-click after the preview has refreshed; Ctrl/Cmd+Shift-click to extend; try removing the last selection | Plain clicks select only one; Ctrl/Cmd toggles; Shift selects a visible range and both modifiers extend it; unavailable versions are skipped; the preview lists translations in selection order; the last one left can't be removed (the sidebar says so) |
| F4 | Type `français`, then `French`, `צרפתית` and `fr` in the filter box above the list; with a hidden pick, Ctrl/Cmd-click a visible version, then plain-click one | Each lists the French translations; filtering alone preserves all picks; Ctrl/Cmd adds/removes one and retains hidden picks; plain click replaces the entire selection |
| F5 | Insert the multi-selection with **Link title to Sefaria** and **Citation** on | One block per translation, in pick order, each titled once with its version; each link opens that translation; a blank line after every citation, including the last; every block formatted like the first |
| F6 | Deuteronomy 6:4's translation list; then Preferences → Search → Advanced → **Show unavailable translations** | A translation with no text for the verse (the Yiddish) is not listed; with the setting on, it is listed greyed out, *unavailable for this ref* |
| F7 | Untick a language in Preferences → Search → **Translation Languages** | It leaves the version list and the search language filter |
| F8 | Cursor in a table cell: insert Hebrew only, then Stacked, then **Right–Left**; then click in the header and insert | Hebrew only and Stacked go **inside the cell**; Right–Left goes **directly below the table**, and the sidebar says why; the header gets a message asking you to click in the main text |
| F9 | `Genesis 1:31-2:3`, both languages, **Line numbers** on | (31), then a *Chapter 2* / *פרק ב* heading, then (1) (2) (3), in both languages |
| F10 | `Genesis` alone | The preview shows *Genesis 1*, and Add Source inserts that chapter |
| F11 | `Shulchan Arukh, Orach Chayim 669` | Inserts in full: Hebrew, translation and credit |
| F12 | `Siddur Rashi 308` (a text with no translation) | Hebrew alone, no empty *(Translation)* heading; its title reads רש"י, not `&quot;` |
| F13 | Hebrew for a text that uses thin spaces (the ref where `&thinsp;` was reported) | No literal `&thinsp;` (or any `&…;`) in the document |
| F14 | Switch off the network; **Add Source**, and **Insert Source from Selection** | Both say Sefaria couldn't be reached — not "no match" |

---

## G. Layout and formatting — 📰 Insertion Options

| # | Check | Expected |
| --- | --- | --- |
| G1 | Open 📰 Insertion Options | Display and Arrangement as labelled segmented controls; each Arrangement icon sketches the page it gives; the tray scrolls to its last row |
| G2 | `Genesis 1:1-5`, both languages, **Right–Left**, **Line by line** on | Five table rows, each verse beside its translation; **Left–Right** is the mirror |
| G3 | The same, **Stacked**; then with two translations picked | The two titles, then each verse followed by its translation; with two, each verse followed by both, in pick order, under one title each |
| G4 | Transliteration on, **Position: Left**, then **Right** (side by side) | A three-column table; the transliteration column is titled in Latin letters (*Bereshit 1:1-5*), linked when the Hebrew title is; with Line by line, each row's transliteration beside its verse. In Stacked, Position is hidden and the transliteration goes under the Hebrew |
| G5 | **Line numbers** off; preview `Genesis 1:1-3`; Add Source. Then on | Off: no numbers, and the switch still reads off after the preview. On: numbered |
| G6 | **Vowels: Tanakh**; insert `Genesis 1:1`, then `Mishnah Berakhot 1:1` | Genesis keeps its vowels; the Mishnah has none. Off and On do what they say |
| G7 | **Cantillation: Torah**; insert `Genesis 1:1`, then `Isaiah 40:1`. Then Cantillation on with **Vowels: Off** | Genesis keeps its ta'amim, Isaiah has none. The last: marks without vowels, in the card's sample and in the insert |
| G8 | Source **Punctuation** off; insert `Genesis 1:1-2` and `Rashi on Genesis 1:1:1`. Then Translation Punctuation off alone | No sof pasuq, paseq or {פ}; a maqaf becomes a space; רש"י and other abbreviations kept. The two switches are independent |
| G9 | With a source previewed, click Vowels twice quickly, then Add Source | *Updating preview…* at once; Add Source waits for the re-fetch; the insert has the vowels the switch shows |
| G10 | Transliteration on, `Deuteronomy 6:4`, then `Genesis 33:1` | The Name reads *HaShem*; each sentence starts with a capital; the names יַעֲקֹב and עֵשָׂו are capitalized; no cantillation mark or meteg in the Latin text; a maqaf is a plain hyphen |
| G11 | Source **Link title to Sefaria** off, Translation on; Preferences → *Name the translation in the title* off; Layout → **Title style: Heading 2** | Only the translation title is linked, and reads *Genesis 1:1* alone; both titles appear in the document outline |
| G12 | Layout → **Citation style**: 10 pt, a colour | The credit line uses it; *Same as the text above* and a blank size go back to the passage's font and size |
| G13 | Source **Text font** David Libre, Cantillation on; insert `Genesis 1:1`. Then *Match the document* in a paragraph set in Heebo | Letters in David Libre, marks in Noto Serif Hebrew — no empty boxes; the preview matches. With Heebo, the marks are in Noto Sans Hebrew |
| G14 | Preferences → Insertion → Translation → **Text font** → *Advanced: formatting for specific languages*: add French with its own font; insert a French translation | French in that font; English unchanged |
| G15 | Insert into a paragraph set in Georgia 14 with every font on *Match the document* | The source in Georgia 14 |
| G16 | **Save as defaults** in Insertion Options; then **Revert** | Preferences shows the saved values; Revert puts the card back to them |

---

## H. Commentary, colour and credit

| # | Check | Expected |
| --- | --- | --- |
| H1 | Insert the **Steinsaltz Talmud**, `Berakhot 2a`, English, **Commentary: Default** | The Talmud's own words **bold**, Steinsaltz's explanation plain |
| H2 | **Combine**, then **Drop** | Combine: no bold, and italic words (*Shema*) still italic. Drop: only the bold text, a line with no bold left out. The preview shows the same words as the insert each time |
| H3 | Drop, with the Hebrew of `Berakhot 2a` | The whole Hebrew, with its own bold (מֵאֵימָתַי) |
| H4 | A footnoted text (Rashi, or a Tanakh with notes) | Footnote markers survive; no raw `<sup>` or `<i>` in the document |
| H5 | Translation **Text font** style *italic*; re-insert H1 | Body italic **and** the source's bold still visible on top |
| H6 | A translation **text colour**; insert | The colour on the body; the source's bold still bold |
| H7 | A **highlight**; insert; set it back to *None*; insert again | The highlight applies, then stops applying |
| H8 | Translation → *Advanced: how the kept bold and italics look*: bold → blue text, not bold; insert H1 | The Talmud's words blue and not bold |
| H9 | Insert with a linked title | The title follows its *Hyperlink formatting override*, not the source's emphasis |
| H10 | **B:** insert `Genesis 1:1`, both languages | A small credit block naming the translation and the Hebrew edition, each with its license where Sefaria provides one |
| H11 | **B:** Hebrew only | A credit block for the Hebrew edition |
| H12 | Stacked, two translations, **Citation** on | The Hebrew edition credited once, under the Hebrew; each translation credited |

> H5 is the layering claim: your style is the baseline, the source's emphasis
> sits on top. H9 is its boundary — titles deliberately do *not* preserve
> source emphasis.

---

## I. Divine names

| # | Check | Expected |
| --- | --- | --- |
| I1 | Divine Name Mappings → turn on the יה replacement; insert `Genesis 29:35` and `Exodus 15:2`, Hebrew | In Genesis 29:35 **יְהוּדָה stays intact**; in Exodus 15:2 the standalone **יָהּ** is replaced |
| I2 | A replacement text containing `$&`; insert a text with that name | The replacement appears literally as typed |
| I3 | Vowels **Off**; insert a Tanakh verse | Vowels gone; the sof pasuq **׃** (and any paseq ׀) still there |
| I4 | Vowels and Cantillation on; insert `Genesis 2:4` | יְהוָ֥ה becomes יְיָ֥ (or יְקוָ֥ק), keeping its marks; with השם it keeps the cantillation |
| I5 | The אלוהים rule on; insert `Genesis 1:1` | אֱלֹהִ֑ים becomes אֱלוֹקִ֑ים, marks kept |
| I6 | English replacement on; insert a translation with *God* and *GOD* | *G-d* and *G-D*; *god* and *gods* untouched |
| I7 | Select a word; **Quick Actions → Transform Divine Names**; Cancel; run again and confirm | A confirmation naming what it changes (the body of the open tab, not the selection, headers, footers or footnotes) and the rules that are on; Cancel changes nothing; then every match is replaced, אֶת־יְהוָה included, and it says how many |
| I8 | **Apply Divine-Name Replacements On Insertion** off; insert `Genesis 2:4` | The Name as Sefaria has it |

---

## J. Link Texts with Sefaria

Build one test document containing, in this order:

1. A clean citation — `Genesis 1:1`
2. An ambiguous one — `Avodah Zarah 2a` (Talmud vs. its commentaries)
3. A nonsense one — `Fakebook 99:99`
4. A citation on a line **~200 characters away** from any other, surrounded by
   plain prose with no citations
5. Two paragraphs of ordinary prose containing no citation at all
6. A chapter the book doesn't have — `Genesis 51:1`
7. A labelled one — `Duplicate A: Genesis 2:1`
8. A traditional form — `Hil. Shabbat 1:1`
9. `Psalms 92:1` on a line of its own

| # | Check | Expected |
| --- | --- | --- |
| J1 | Run it for the **first time** | A one-time confirmation naming which scan mode is active, and asking to continue |
| J2 | Decline it | Nothing is uploaded, nothing changes in the document |
| J3 | Run again, accept | The dialog opens **immediately** with a scanning state — not a frozen menu |
| J4 | When the scan finishes | A summary: how many will link automatically, how many need a choice, how many could not be matched |
| J5 | The ambiguous row | Link and Insert both **unchecked**, a dropdown of candidates; the selected one shows its Hebrew title and an excerpt. Only the review state is visible — no scanning bar or Close button around the table |
| J6 | Pick a candidate | The row's Link box checks itself |
| J7 | Apply | Progress advances; links land on the right words |
| J8 | Check the linked text | `Genesis 1:1` links to Genesis; your chosen candidate links where you chose |
| J9 | **▸ Show N citations that couldn't be matched** | Each in its sentence, with the spellings tried and why: *Fakebook* a book Sefaria doesn't recognise; `Genesis 51:1` with Sefaria's own message (*Genesis ends at Chapter 50*) |
| J10 | `Duplicate A: Genesis 2:1` | Only *Genesis 2:1* is linked; the label stays plain text |
| J11 | `Hil. Shabbat 1:1` | Linked; its row says which spelling found it |
| J12 | Tick **Insert** on the `Psalms 92:1` row (Link on), and Insert only on another; Apply | The citation on its own line is replaced by the source, titled `Psalms 92:1` and still linked; the other source goes below its paragraph, its citation not hyperlinked |
| J13 | **📰 Customize this insertion**: Display *Original*, Vowels Off, *Replace a citation on its own line* off; Insert a row | That source in Hebrew only, without vowels, below its citation; Preferences unchanged until **Save as defaults** |
| J14 | Delete a citation while the review is open, then Apply | It is reported, not linked somewhere else |
| J15 | Run the whole thing again | Already-linked references are **not** re-offered or double-linked; the second run works (no *RESOURCE_EXHAUSTED*) |
| J16 | Preferences → Linking → After linking → **Show every match**, re-run on a fresh copy | All matches listed, unambiguous ones pre-checked |
| J17 | After linking → **Just link and report a count**, re-run | No dialog; a message with counts, including what was skipped |
| J18 | Switch *After linking* between modes | **Insert text after linking** appears only for *Just link and report a count* |
| J19 | Turn it on, re-run on a fresh copy | No dialog; each linked source inserted below its paragraph, and the counts include insertions |
| J20 | Document scanning → **Whole document**, re-run on a fresh copy | Item 4, if the partial scan reported it *fell across a gap*, now links |

> **J9 is the point of the whole feature.** The published add-on reported
> "Linked N references" and nothing else. If a failure is still invisible here,
> the release has not delivered its main claim.
>
> J4 may also report *"fell across a gap in the partial scan"* — the
> unplaceable count, which item 4 provokes. Its remedy is switching to
> **Whole document**, which J20 checks.

---

## K. Voices, Lexicon and the Session Library

| # | Check | Expected |
| --- | --- | --- |
| K1 | Voices: search `shabbat` | Sheets grouped under topics (*Shabbat & Holidays*, *Halakhah*, …), a chip per topic; ❌ hides a group; each row shows its author and topics; snippets highlight matches with no raw tags |
| K2 | Preferences → Search → **Voices Topics**: move one, hide one; search again | The groups follow; the hidden one stays out unless its chip shows it |
| K3 | Select a sheet; *What to insert*: **Citation**, **Text**, then **Both** | Both is the sheet's text under its title, linked to the sheet, once; media links point at real URLs |
| K4 | Voices **Transliteration → Traditional** with Both | The button reads *Traditional* with a sample; each Hebrew passage is followed by its transliteration in parentheses, English untouched; the Texts transliteration unchanged |
| K5 | Lexicon: `שם` | Words, not entries: *Matches* then *Related words*; a chip per dictionary with its count; clicking one hides that dictionary's entries for this search |
| K6 | Pick a word; click Klein and BDB entries (then **Select all**); **Add Entry** with *Full entry*; then **Copy** | The word as a heading once, a dictionary line per entry in pick order, each sense its own paragraph with the dictionary's numbers, sub-senses indented. Copy gives the same lines |
| K7 | Lexicon: `peace` | Hebrew words that mean it, שָׁלוֹם among them — not "no entries" |
| K8 | Preferences → Search → **Lexicon Dictionaries**: Jastrow first, hide Strong's | Entries follow the order; Strong's chip crossed out, and clicking it shows Strong's for this search only |
| K9 | Pin a text, a sheet and a word; open 📜 (or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd>) | Filed under their kinds (*Source Sheets*, *Dictionary*); clicking the sheet opens Voices with the search that found it and selects it when it answers |
| K10 | Pin in the Library window, **Done**, reopen 📜 at once | The pin kept; 📜 opens on the first click |
| K11 | **Copy References** | The list of what you used, on the clipboard |
| K12 | A private (incognito) window | The sidebar works; Session Library and search history empty, not broken |

---

## L. Quick Actions, Surprise Me and the rest

| # | Check | Expected |
| --- | --- | --- |
| L1 | Select `Genesis 1:1`; **Insert Source from Selection** | The selection is **replaced** by the source, titled `Genesis 1:1`. With Preferences → Insertion → Insert from Selection → *replaces the selection* off, the selection stays and the source goes below it |
| L2 | Quick Actions → **Unlink Sources** | Removes sefaria.org links, leaves other links alone |
| L3 | Quick Actions → **Gematriya Count**, with Hebrew selected and with nothing selected | A value for the selection, then for the whole document |
| L4 | Preferences → 🧪 Experimental: turn on Surprise Me. Compare the sidebar's 🧪 card with *Menu → Surprise Me* | The same form; the status says how many were inserted and for which word |
| L5 | Set Stacked, Line numbers off and Citation on in Preferences; in the sidebar's Insertion Options switch to Right–Left; run Surprise Me | Inserted Stacked, unnumbered, with titles linked and the credit line: the saved defaults, not the sidebar's session change |
| L6 | Anywhere in the add-on | No AI Shiur card, footer 🧠 button, or AI option |

---

## M. Privacy and About

| # | Check | Expected |
| --- | --- | --- |
| M1 | **B:** Google's permission screen at install | Four permissions: this document, the add-on's windows, connecting to an external service, storing its settings. Nothing about your email address, profile or Drive |
| M2 | Preferences → Linking → **🔒 Privacy & Document Scanning** → policy link | Opens Sefaria's privacy policy, `https://www.sefaria.org/privacy-policy` |
| M3 | *Help & Support → About* → **Privacy policy** and **GitHub** pills | The same policy, and `TheMerkazDev/TorahLibraryAddOnForDocs`; **Terms** opens `https://www.sefaria.org/terms` and **Help Center** Sefaria's Help Center; About reads as user-facing text, with no "fork" wording |
| M4 | *About* → **What's new** | Release Notes, *Version 2.0*: what's new since version 1.0, and what works differently |

---

## N. Sefaria v3 migration (pending)

Added 2026-11-24 for the migration described in
[the technical handoff](sefaria-api-migration.md). These checks are **not yet
run in Google Docs**. Run them against the migration commit's HEAD deployment
and record that commit below. Automated live API checks do not replace them.

| # | Check | Expected |
| --- | --- | --- |
| N1 | Texts: preview and insert `Genesis 1:1` with both languages and Citation on | Hebrew and translation present; edition titles and licenses match the selected editions; bold and italics survive |
| N2 | On that passage, choose a French translation, then Yiddish, and change the source edition | Each preview and insert uses the named edition and its language; no silent default-edition substitution; source and translation remain in their intended output positions |
| N3 | Choose two translations in Stacked and insert; repeat with translation-only output | Both translations insert in selection order, credited separately; Stacked credits the source edition once |
| N4 | Search `Genesis`, `Berakhot`, `Sefer HaChinukh`, then a structural heading such as `Mishneh Torah` | Simple books open their first available section; complex default text opens its main text; a structural heading stays non-insertable; no entire book or arbitrary introduction is inserted |
| N5 | Insert `Genesis 1:31-2:3` with Line numbers and Line by line on; repeat with both off | The requested range only; chapter headings, restarted numbers, Hebrew/translation pairing and unnumbered prose remain correct |
| N6 | On `Genesis 1:1`, compare available translations with a later passage and toggle Show unavailable translations | Editions with no passage text are absent or disabled as configured; a failed availability lookup does not empty the picker |
| N7 | Insert Source from Selection, Link Texts with `Hil. Shabbat 1:1` and `Duplicate A: Genesis 2:1`, then Surprise Me | All fetch paths work; linker excerpts match their targets, duplicate labels stay plain, and insertion uses the intended passage and saved/session options for that action |
| N8 | Preview and insert a Tanakh passage and `Berakhot 2a` with vowel, cantillation, punctuation and divine-name options; include transliteration | Existing Hebrew filters and transliteration remain consistent with the chosen options; source markup and current Commentary behavior are preserved |
| N9 | Repeat a passage lookup, change editions, and try `Fakebook 99:99`; also search Voices and Lexicon | Repeated lookups and edition changes still work; an unknown reference is a normal miss; Voices/ Lexicon remain usable through their existing endpoints |

The separately reported Insertion Options selection-reset and Tanakh
commentary/footnote issues remain scheduled for A–D. Record observations,
but do not mark those fixes complete from this migration's checks.

---

## Reporting back

For anything that fails, the useful report is:

1. The check id
2. What you saw versus what the table says
3. **Browser console output** — most of the failure modes here (SRI, CSP,
   `google.script.run`) show there and nowhere else
4. Which account (A upgrading / B fresh / C from version 1.0), the
   interface (Simple / Everything) and the scan mode in effect

State the version too: **2.0.0, schema 31**. "It broke" is not checkable
later; the version and the check id are.

---

## Results

Record each run here and commit it with the release, so there is evidence the
checklist was run against the code that shipped.

| Date | Tester | Account (A/B/C) | Apps Script version / commit | Result | Failures (check ids) |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
