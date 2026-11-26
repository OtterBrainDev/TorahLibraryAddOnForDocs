# Live test checklist — v2.0.0

Run this in a real Google Doc against HEAD — after `clasp push`, installed via
Apps Script → Deploy → Test deployments — before creating the release version
and pointing the Marketplace SDK at it. Everything here is something the
automated suite **cannot** reach: `npm test` covers logic, contracts and
snapshots; opt-in live API checks separately cover Sefaria responses. Neither
kind of automated check holds a `DocumentApp` handle or proves that this HEAD
works in the Apps Script sidebar and a real document.

**Version under test:** 2.0.0 · **preference schema:** 34 (both from
`docs/VERSION.json`)
Confirm both before starting — *Help → About* should read
**Current line: 2.0**. This confirms the release line only: record the exact
commit pushed to the Apps Script project and the test deployment used. The
About label alone cannot distinguish two builds on the same release line.

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
  34) keep what users chose. Take a screenshot of Preferences before the push.
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
| A3 | **B:** *Help → Re-run Setup Wizard*, choose Keep Current Preferences, then Skip for now; reload | Setup reopens with current choices and closes without preference changes; it is not shown again on its own |
| A4 | **C:** install; open the document version 1.0 inserted into; open **Extensions** | Two *Sefaria for Google Docs* submenus (the published 1.0 and this build), each with its own items; the first-run setup opens once |
| A5 | **C:** on screen 1 choose **I've used Sefaria for Google Docs 1.0**; Continue | Setup completes immediately: bilingual Hebrew-right, Simple, quiet linking, Voices/Lexicon off, Add Sources with Sefaria, no automatic divine-name substitution |
| A6 | **C:** insert `Genesis 1:1` and then a passage with יהוה using the 1.0 preset | A two-column table, Hebrew on the right; source divine-name spelling preserved; a small edition/license credit line |
| A7 | **C:** *Help →* **Coming from version 1.0** | In the Help navigation and on Quick start; every link in it lands |
| A8 | **C:** run **Transform Divine Names**, **Link Texts with Sefaria** and **Unlink Sources** on the text version 1.0 inserted | Each works on it like any other text; Unlink removes its sefaria.org links too |

---

## B. Smoke and Content Security Policy

| # | Check | Expected |
| --- | --- | --- |
| B1 | Open the add-on menu (Everything) | **Texts / Voices / Lexicon / Insert Source from Selection / Quick Actions** (Quick Actions Sidebar, Transform Divine Names, Link Texts with Sefaria, Unlink Sources, Gematriya Count), then **Preferences** and **Help**, last |
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
| C1 | *Help → About* | **Current line: 2.0**; *New in 2.0* |
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
| D1 | Preferences → **Interface: Simple**, with the sidebar open | At once, without Save or a refresh: the menu is Texts, Insert Source from Selection, Transform Divine Names, Link Texts with Sefaria, then Preferences and Help; the sidebar loses the result sort, ⤦ Restore Corpus and 🧪 (tabs, Add Source, Insertion Options and the footer stay); Preferences hides Search, Linking and 🧪 Experimental |
| D2 | Back to **Everything** | Your own menu returns; no setting changed; values not yet saved (and Menu Bar edits) are still there |
| D3 | Preferences → **Sidebar**: switch off **Lexicon** and one Quick Actions button; Save | The Lexicon tab and menu item disappear, as does that sidebar action; switching mode does not re-enable them |
| D4 | Sidebar tab (Everything): switch off Insertion Options' **Punctuation**; Save | Gone from the sidebar's Insertion Options; still in Preferences and Link Texts; inserts use the saved value |
| D5 | Re-enable Lexicon and Save first; in **Menu Bar** move it to Quick Actions, then back to main menu; untick an item; Save; reload | Lexicon goes to the end of Quick Actions, then back just below it; the unticked item is gone; Preferences and Help last |
| D6 | In both modes, confirm Details is first and the Profiles rail stays visible. Switch from This Document to User Profile, create a named profile, change Vowels and save. | User Profile cannot be renamed or deleted. The name field, pencil, and trash operate on named profiles. Import/Export opens from Details beside those icons. Switching with edits asks whether to save them. |
| D7 | **Advanced**: name it *Test*, **Export settings file**; change Vowels and the Hebrew font, Save; import the file, ticking only *Text and layout* | A `.json` download (if blocked, the text to copy). The import preview lists what each part would change; only Vowels comes back, the font stays |
| D8 | Import `{"format":"torah-library-settings","formatVersion":1,"prefsSchemaVersion":"99","settings":{}}` | "made by a newer version"; nothing changes |
| D9 | In both interfaces, open **Profiles → Reset options**. Test **Reset active profile** and **Restore Factory preset** on a test account | Profile reset restores text, layout and appearance. Factory matches the supplied preset, sets Simple and preserves inactive profiles and upload consent |
| D10 | **🔁 Refresh** | *Refreshing the sidebar…*; the sidebar reopens from saved defaults |
| D11 | ⚙︎ in the sidebar footer, three times quickly | *Opening Preferences…* over the sidebar; one Preferences dialog |
| D12 | Change Notes in This Document and click **🡆 Update Sidebar Preview** with a source previewed. Reopen the sidebar before saving. Use **💾 Save** without closing. Then edit again, use **Save & Close**, reopen the Doc and compare with a second Doc. Click **🏭 Restore Factory preset** and open its confirmation. | Preview updates only the open session. Save & Close identifies the destination and changed setting. The first Doc keeps its saved Notes; a second Doc inherits reusable defaults. Both Factory buttons are dark red, and restoring Factory preserves the first Doc’s explicit overrides. |
| D13 | Set Notes differently in User Profile, a named profile, and This Document. With the named profile in use, choose This Document → Details → Reset options → **Clone Account Settings**. | Confirmation describes replacement. The Doc receives the saved User Profile setting. The named profile stays active for another Doc, and later User Profile edits do not change the cloned value. |
| D14 | With an unsaved edit, try the add-on’s **✕ Close Preferences** and Escape from the form. Test all three choices and a failed save. Repeat using the Google Docs title-bar X and record whether the browser shows its native warning. | Cancel keeps edits, Don’t save drops them, and Save & Close waits for success. A failed save keeps the form open. Clean forms close without prompting. Google Docs controls the outer dialog close. |
| D15 | Use Import/Export from This Document, and restore the updated Factory preset. | The transfer says it is loading saved settings. Factory selects Simple, uses right-side Hebrew, separates Notes, and uses Quiet Link Texts review. |

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
| E12 | A footnoted text's **preview** — JPS2023 `Genesis 1:1` with **Notes: Inline**, and a William Davidson English Talmud page with **Commentary: Default** | Bold, italics and the included note render without visible tags. **This checks the sanitizer**, which keeps only a fixed set of formatting tags; Notes: Omit deliberately hides semantic notes and their markers |
| E13 | A phrase search, e.g. `in the beginning` | Results appear (Sefaria's `/api/search-wrapper/es8` route) |
| E14 | Preferences → Search: move Talmud above Tanakh, hide Midrash; search `shabbat` | Groups in that order, no Midrash; ⤦ Restore Corpus shows it marked *(Preferences)* |
| E15 | Texts: type `shalom`, press Enter; switch to Voices, then Lexicon, then back | Each tab's badge counts its results; switching never searches again, the box keeps its text, and Texts comes back with its selection and preview |
| E16 | Texts: `Genesis 1:1`, Enter; switch to Lexicon | Not looked up in the Lexicon, and no stale *No lexicon entries found for 'Genesis 1:1'* message |
| E17 | ⌨︎ Hebrew keyboard; then <kbd>Alt</kbd> + <kbd>/</kbd>, <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> | Types Hebrew, with a vowels row; Alt + / jumps to the search box, the arrows move through results, Ctrl/⌘ + Enter adds the source |

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
| F3a | Open a passage with many translations. Scroll down, click a visible edition, wait for the preview, then Ctrl/Cmd-click another and Shift-click a range. Apply a filter and change a preview layout option | The list keeps its scroll position, focus, filter and selected editions for the passage. The chosen rows stay in view after the preview reloads. Test both single- and multi-select layouts |
| F3b | Open Versions at normal sidebar width in Stacked and side by side. Hover, focus, and activate each available ⓘ. Press Escape | Each picker has one labeled heading and its count. Help is visible on hover or focus, fits the sidebar, adds no row, and can be dismissed without toggling the accordion. Multi-selection help appears only when the layout supports it |
| F4 | Type `français`, then `French`, `צרפתית` and `fr` in the filter box above the list; with a hidden pick, Ctrl/Cmd-click a visible version, then plain-click one | Each lists the French translations; filtering alone preserves all picks; Ctrl/Cmd adds/removes one and retains hidden picks; plain click replaces the entire selection |
| F4a | Select French in the Texts search language menu and search a title and a verse. Add English, then choose Any. | A result must contain text in at least one selected translation language. Title and fuzzy candidates are checked too. Any restores unfiltered results. |
| F4a | Preview Genesis 1:1. Under **Source editions**, choose **Tanach.us (full edition)** and toggle Vowels and Cantillation. Compare Miqra according to the Masorah. Repeat with an already selected pre-stripped Tanach.us edition | The full Tanach.us edition is one choice, its two pre-stripped forms are normally hidden, and an active pre-stripped choice remains selectable. The marks follow the controls on the full edition. Insertion and citation retain the actual Sefaria edition title |
| F5 | Insert the multi-selection with **Link title to Sefaria** and **Citation** on | One block per translation, in pick order, each titled once with its version; each link opens that translation; a blank line after every citation, including the last; every block formatted like the first |
| F6 | Deuteronomy 6:4's translation list; then Preferences → Search → Advanced → **Show unavailable translations** | A translation with no text for the verse (the Yiddish) is not listed; with the setting on, it is listed greyed out, *unavailable for this ref* |
| F7 | Untick a language in Preferences → Search → **Translation Languages** | It leaves the version list and the search language filter |
| F8 | Cursor in a table cell: insert Hebrew only, then Stacked, then **Right–Left**; then click in the header and insert | Hebrew only and Stacked go **inside the cell**; Right–Left goes **directly below the table**, and the sidebar says why; the header gets a message asking you to click in the main text |
| F9 | `Genesis 1:31-2:3`, both languages, **Line numbers** on | (31), then a *Chapter 2* / *פרק ב* heading, then (1) (2) (3), in both languages |
| F10 | Search `Genesis`, choose Chapter 2 in its table of contents and select **Open section**. Repeat with a daf in `Berakhot` and a named section in `Pesach Haggadah` | Add Source stays disabled at the root. Opening a section loads just that section and enables insertion when its text is ready |
| F11 | `Shulchan Arukh, Orach Chayim 669` | Inserts in full: Hebrew, translation and credit |
| F12 | `Siddur Rashi 308` (a text with no translation) | Hebrew alone, no empty *(Translation)* heading; its title reads רש"י, not `&quot;` |
| F13 | Hebrew for a text that uses thin spaces (the ref where `&thinsp;` was reported) | No literal `&thinsp;` (or any `&…;`) in the document |
| F14 | Switch off the network; **Add Source**, and **Insert Source from Selection** | Both say Sefaria couldn't be reached — not "no match" |

---

## G. Layout and formatting — 📰 Insertion Options

| # | Check | Expected |
| --- | --- | --- |
| G1 | Open 📰 Insertion Options | Display and Arrangement as labelled segmented controls; each Arrangement icon sketches the page it gives; the tray scrolls to its last row |
| G2 | Preview `Genesis 1:1-5` with Both and **Right–Left**. Turn **Line by line** on, off and on again without touching Arrangement. Repeat with **Stacked** | The preview redraws at each toggle. Aligned side-by-side shows one row per verse beneath the titles. Aligned Stacked puts each verse before its translation. Add Source follows the final choice |
| G3 | The same, **Stacked**; then with two translations picked | The two titles, then each verse followed by its translation; with two, each verse followed by both, in pick order, under one title each |
| G4 | With that passage already previewed in a side-by-side arrangement, turn **Transliteration** on and choose **Below**, **Left**, then **Right**. Repeat with Line by line on, then switch to **Stacked**. Turn Transliteration off while a preview update is pending | The preview shows the reading below or on the chosen side of the Hebrew. Aligned rows retain their own reading, and Stacked places each reading before the translation. Turning it off clears the reading and late replies cannot restore it. The inserted separate column has its Latin title (*Bereshit 1:1-5*), linked when the Hebrew title is |
| G5 | **Line numbers** off; preview `Genesis 1:1-3`; Add Source. Then on | Off: no numbers, and the switch still reads off after the preview. On: numbered |
| G6 | **Vowels: Tanakh**; insert `Genesis 1:1`, then `Mishnah Berakhot 1:1` | Genesis keeps its vowels; the Mishnah has none. Off and On do what they say |
| G7 | **Cantillation: Torah**; insert `Genesis 1:1`, then `Isaiah 40:1`. Then Cantillation on with **Vowels: Off** | Genesis keeps its ta'amim, Isaiah has none. The last: marks without vowels, in the card's sample and in the insert |
| G8 | Source **Punctuation** off; insert `Genesis 1:1-2` and `Rashi on Genesis 1:1:1`. Then Translation Punctuation off alone | No sof pasuq, paseq or {פ}; a maqaf becomes a space; רש"י and other abbreviations kept. The two switches are independent |
| G9 | With a source previewed, click Vowels twice quickly, then Add Source | *Updating preview…* at once; Add Source waits for the re-fetch; the insert has the vowels the switch shows |
| G9a | Preview a source, collapse Preview, and simulate an insertion RPC or multi-translation retrieval failure | The busy overlay clears and an error appears beside Add Source. The chosen reference and editions stay available for retry. The retry clears the old error |
| G10 | Transliteration on, `Deuteronomy 6:4`, then `Genesis 33:1` | The Name reads *HaShem*; each sentence starts with a capital; the names יַעֲקֹב and עֵשָׂו are capitalized; no cantillation mark or meteg in the Latin text; a maqaf is a plain hyphen |
| G11 | Source **Link title to Sefaria** off, Translation on; Preferences → *Name the translation in the title* off; Layout → **Title style: Heading 2** | Only the translation title is linked, and reads *Genesis 1:1* alone; both titles appear in the document outline |
| G12 | Layout → **Citation style**: 10 pt, a colour | The credit line uses it; *Same as the text above* and a blank size go back to the passage's font and size |
| G13 | Source **Text font** David Libre, Cantillation on; insert `Genesis 1:1`. Then *Match the document* in a paragraph set in Heebo | Letters in David Libre, marks in Noto Serif Hebrew — no empty boxes; the preview matches. With Heebo, the marks are in Noto Sans Hebrew |
| G14 | Preferences → Insertion → Translation → **Text font** → *Advanced: formatting for specific languages*: add French with its own font; insert a French translation | French in that font; English unchanged |
| G15 | Insert into a paragraph set in Georgia 14 with every font on *Match the document* | The sidebar font controls read **Match formatting**, including after changing the cursor font. The source follows Georgia 14. A specific override shows the chosen font by name |
| G16 | **Save as defaults** in Insertion Options; then **Revert** | Preferences shows the saved values; Revert puts the card back to them |

---

## H. Commentary, colour and credit

| # | Check | Expected |
| --- | --- | --- |
| H1 | Insert `Berakhot 2a`, **William Davidson Edition - English**, **Commentary: Default** | The Talmud's own words **bold**, Steinsaltz's explanation plain |
| H2 | **Combine**, then **Drop** | Combine: no bold, and italic words (*Shema*) still italic. Drop: only the bold text, a line with no bold left out. The preview shows the same words as the insert each time |
| H3 | Drop, with the Hebrew of `Berakhot 2a` | The whole Hebrew, with its own bold (מֵאֵימָתַי) |
| H4 | `Genesis 1:1`, **THE JPS TANAKH: Gender-Sensitive Edition**, **Notes: Inline**, then **Separate**, then **Omit** | Note text appears inline, then in a labelled Notes section with its marker, then neither note nor marker; no raw `<sup>` or `<i>` in the document. Repeat in O9 with each Commentary mode |
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
| L1 | Select `Genesis 1:1` on its own line; **Insert Source from Selection**; confirm Insert in review | The own-line citation is replaced by the source, titled `Genesis 1:1`, if replacement is enabled. With replacement off the citation stays; inside prose it also stays. No write before Apply. |
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
| M3 | *Help → About* → **Privacy policy** and **GitHub** pills | The same policy, and `TheMerkazDev/TorahLibraryAddOnForDocs`; **Terms** opens `https://www.sefaria.org/terms` and **Help Center** Sefaria's Help Center; About reads as user-facing text, with no "fork" wording |
| M4 | *About* → **What's new** | Release Notes, *Version 2.0*: what's new since version 1.0, and what works differently |

---

## N. Sefaria v3 migration (pending)

Added 2026-11-24 for the migration described in
[the technical handoff](sefaria-api-migration.md). These checks are **not yet
run in Google Docs**. Run them against the migration commit's HEAD deployment
and record that commit below. Automated live API checks do not replace them.

| # | Check | Expected |
| --- | --- | --- |
| N1 | Texts: preview and insert `Genesis 1:1` with both languages and Citation on | Hebrew and translation present; edition titles and licenses match the selected editions, with one credit line per edition and working links for known licenses. Bold and italics survive |
| N2 | On that passage, choose a French translation, then Yiddish, and change the source edition | Each preview and insert uses the named edition and its language; no silent default-edition substitution; source and translation remain in their intended output positions |
| N3 | Choose two translations in Stacked and insert; repeat with translation-only output | Both translations insert in selection order, credited separately; Stacked credits the source edition once |
| N4 | Search `Genesis`, `Berakhot`, `Sefer HaChinukh`, then a structural heading such as `Mishneh Torah` | Simple books open their first available section; complex default text opens its main text; a structural heading stays non-insertable; no entire book or arbitrary introduction is inserted |
| N5 | Insert `Genesis 1:31-2:3` with Line numbers and Line by line on; repeat with both off | The requested range only; chapter headings, restarted numbers, Hebrew/translation pairing and unnumbered prose remain correct |
| N6 | On `Genesis 1:1`, compare available translations with a later passage and toggle Show unavailable translations | Editions with no passage text are absent or disabled as configured; a failed availability lookup does not empty the picker |
| N7 | Insert Source from Selection, Link Texts with `Hil. Shabbat 1:1` and `Duplicate A: Genesis 2:1`, then Surprise Me | All fetch paths work; linker excerpts match their targets, duplicate labels stay plain, and insertion uses the intended passage and saved/session options for that action |
| N8 | Preview and insert a Tanakh passage and `Berakhot 2a` with vowel, cantillation, punctuation and divine-name options; include transliteration | Existing Hebrew filters and transliteration remain consistent with the chosen options; source markup and current Commentary behavior are preserved |
| N9 | Repeat a passage lookup, change editions, and try `Fakebook 99:99`; also search Voices and Lexicon | Repeated lookups and edition changes still work; an unknown reference is a normal miss; Voices/ Lexicon remain usable through their existing endpoints |

The separately reported selection-reset and commentary/footnote fixes are
prepared on the A–D follow-up branch. Section O verifies them independently;
passing the API migration checks alone does not mark those fixes complete.

---

## O. Edition persistence, commentary and notes — A–D (pending)

Added 2026-11-24 for branch `fix/edition-commentary-notes-20261124`, based on
the v3 migration. **All checks below are pending in Google Docs.** Use a HEAD
deployment containing both changes, record its commit and schema (**32** for
the A–D branch; **33** when the launch-defaults follow-up is included), and
compare the selected edition names, sidebar preview and inserted document.
The offline and live API tests do not replace these checks.

| # | Check | Expected |
| --- | --- | --- |
| O1 | Preview `Genesis 1:1`; choose a non-default translation and a different Hebrew edition. Change Vowels, Cantillation and each Punctuation option, one at a time | Both edition names stay selected; each refreshed preview and insertion uses them. Add Source waits while the refresh is loading |
| O2 | Stacked: choose three translations using Ctrl/Cmd-click, filter the list, then change Insertion Options. Extend the selection with Shift-click | Selection order and the range anchor survive; a hidden selection is retained. The multi-translation summary and inserted blocks agree with the list |
| O3 | Change an option that refetches, then immediately choose another edition; repeat with several quick option changes and a slow connection | No older response replaces the latest choice or re-enables Add Source while the newer request is outstanding. A missing chosen edition leaves insertion disabled with guidance |
| O4 | After O2, choose another reference; then switch a multi-selection from Stacked to a side-by-side arrangement | The new reference gets its own appropriate edition selection. A layout permitting one translation has one unambiguous selection and matching preview; stale choices from the previous reference do not leak in |
| O5 | `Berakhot 2a`, **William Davidson Edition - English**: preview and insert Default, Combine and Drop; include italic words | Default keeps bold base and plain explanation; Combine keeps all words without source bold; Drop keeps base text. Retained italic words remain italic. Hebrew remains whole |
| O6 | **The Rashi chumash by Rabbi Shraga Silverstein**: test `Genesis 1:1`, `Exodus 37:8` and nested-bracket `Numbers 11:4` in all three Commentary modes | Default keeps additions in brackets; Combine keeps their words without brackets; Drop removes complete bracketed additions. Base words and retained italics survive; preview matches insertion |
| O7 | `Psalms 1:1`, **The Rashi Ketuvim by Rabbi Shraga Silverstein**, all three Commentary modes | Same bracket convention as O6; the exact Ketuvim edition is recognized |
| O8 | Silverstein `Genesis 49:17` and `Genesis 24:7`, individually and in a range with adjacent verses, with Combine and Drop | Each malformed-bracket verse stays whole. It neither loses its trailing base text nor causes any adjacent verse to be removed |
| O8a | In the sidebar, open **Text and notes** with Both displayed. Compare an ordinary note-free translation, a marked JPS passage, and a supported Silverstein edition | Source and Translation are labeled. Commentary disables for unsupported editions and explains why in ⓘ. Notes disables only when the displayed text has no marked notes. Opening Preferences still allows setting either default |
| O9 | JPS2023 `Genesis 1:1`: cross **Notes: Omit / Inline / Separate** with each Commentary mode | Omit removes the semantic note and marker; Inline shows the note at its place; Separate keeps a marker and labelled Notes section. The bold quotation inside the note never becomes the only surviving translation; requested notes remain independent of Commentary |
| O10 | JPS2023 `Genesis 1:30` with Drop; then choose Kehot `Genesis 1:1` or `Steinsaltz on Genesis 1:1` and test Combine / Drop | JPS's `[I give]` stays. Unregistered editions preserve their words and source emphasis, with help explaining that the convention is not supported; semantic notes still follow Notes |
| O11 | A range containing several JPS notes: Separate, both languages; test Stacked, side by side, Line by line on/off, and several translations | Notes remain attached to their own passage or aligned line and edition, without entering the Hebrew/transliteration column or another translation's notes. Numbering, titles and credits remain correct. Separate creates ordinary Notes text sections, not native Docs footnotes |
| O12 | A source edition with marked Hebrew footnotes: record its exact reference/edition and compare Omit, Inline and Separate; include a passage containing ordinary superscript/subscript text | Notes applies to Hebrew as well as translation. Ordinary superscript/subscript content survives; omitting a footnote does not remove following main text |
| O13 | Account A: upgrade from schema 31 without resetting; Account B: install fresh. Change Notes, save a profile, export/import Text and layout, reopen the sidebar, and use Revert / Save as defaults | Both start with Notes: Separate when unset. Accounts with an existing Notes value keep it. The chosen note mode survives each intended settings route; session-only changes stay session-only and saved values are not overwritten |
| O14 | Set Notes in saved Preferences, then compare Add Source, Insert from Selection, Link Texts (including Customize this insertion), and Surprise Me; inspect Help and tooltips | Each action uses its documented saved/session/one-pass options. Help names supported editions, independent Notes modes, preservation of unknown/malformed conventions and the absence of native footnotes; no broad claim that all bold or brackets are commentary |

Record any failure by check ID in the existing Results table below. No
Apps Script deployment or release is implied by this section's presence.

---

## P. Launch compatibility and defaults review (pending)

Added 2026-11-24 for `review/launch-defaults-help-20261124`, schema **33**.
These cases supplement N and O. They remain **NOT RUN in Google Docs**;
offline coverage and live Sefaria API checks are recorded in
[the handoff](sefaria-api-migration.md#launch-review--compatibility-defaults-and-documentation).

| # | Starting state and action | Expected / evidence to record |
| --- | --- | --- |
| P1 | Preview and insert `Rashi on Genesis 1:2:1`; explicitly select only the translation, then only the source, named **Pentateuch with Rashi's commentary by M. Rosenbaum and A.M. Silbermann, 1929-1934** | Both Hebrew and English stay present, with their own role metadata and credit, even though the edition titles are identical. Record selected titles, preview and inserted text. |
| P2 | Start with Both and selected editions, then encounter a missing selected edition. Switch to the single-language output whose edition is available; switch back to Both | The usable language recovers after a fresh response. Returning to Both revalidates the missing edition and keeps Add Source disabled until resolved. No stale preview becomes insertable during the switch. Record the exact passage and editions used. |
| P3 | Account A: upgrade from schema 32 with non-default Voices output/transliteration, Lexicon output, Commentary and Notes. Open an inactive old profile, then return | All valid saved choices survive; a never-set workflow has Citation / None / Full entry defaults. If an older test profile contains the generated `undefined` value, only that invalid value is repaired. Capture before/after values. |
| P4 | In an authorized test account, change the three workflow modes, Commentary and Notes, then use Profiles → Reset active profile; export Text and layout and reopen the sidebar | Voices Citation, Voices transliteration None, Lexicon Full entry, Commentary Default and Notes Separate agree in Preferences, export and sidebar. The chosen Simple / Everything interface remains unchanged. Restore the test account's original settings afterward. |
| P5 | Choose a confirmed partial edition over a range; record the exact passage and edition, compare it on Sefaria, and inspect Line by line on/off | Missing segments stay gaps and are not borrowed from another edition. A listed edition is not a guarantee of complete coverage. Check Help's explanation; there is no per-verse completeness notice in this build. |
| P6 | Time the first preview, a repeated lookup and an edition change; run a representative Link Texts scan on a test document | Record actual time and any Apps Script quota/timeout error, browser and exact HEAD commit. Metadata preflight adds work; API-only timings do not establish sidebar performance. Do not assign a pass without observing the core tasks complete. |
| P7 | Follow the returning-user and new-user scripts, open Help → About → What's new, and follow a Help link to the Notes guidance | Labels match the implemented UI, the supported commentary editions and Notes choices are clear, saved defaults are distinguished from session changes, and no page promises exact pagination or a preview of every selected translation. With the later sidebar follow-up included, use Q to verify its implemented grouping. |

Record results and failures in the existing table below, identifying N/O/P
case IDs. Neither this section nor source-updated tutorials establish a
tested deployment or a completed demonstration recording.

---

## Q. Sidebar grouping and senior walkthrough (pending)

Added 2026-11-24 for the updated PR #60, **2.0.0 pending release, schema 33**.
All cases remain **NOT RUN in Google Docs**. The source suite has 1,032
passing tests; no native browser rendering or Docs run is implied. Record the
exact commit/test deployment, browser, sidebar width and starting settings.
Use an authorized disposable document and restore temporary defaults and
profiles afterward.

| # | Starting state and action | Expected / evidence to record |
| --- | --- | --- |
| Q1 | Open Insertion Options in Simple and Everything at normal sidebar width. Switch Display and Arrangement | Readable labels. Line by line remains outside groups with Both; Transliteration remains outside groups when original text is included. Style/Position appear as applicable. All controls remain reachable by scrolling. |
| Q2 | Set Notes Separate, Commentary Drop, Citation off and custom Hebrew font/size. Collapse/reopen every group | Summaries expose consequential values without clipping. Opening/closing changes no setting, edition, preview or fetch. |
| Q3 | Hide controls in Preferences → Sidebar, including every control in a group. Switch languages; inspect Preferences/Link Texts | Hidden controls stay hidden; empty sidebar groups disappear. Notes remains available for Original-only unless hidden. Effective values and expansion state survive redraw; other hosts retain detailed editors. |
| Q4 | Use Tab, arrows and Home/End in choices. Open Style, navigate without selecting, Escape, then select None | One tab stop per radio group; Ctrl/Alt/Meta navigation chords do not change settings. Style commits only on selection; Escape closes the menu alone; None returns focus to Transliteration. Check accessible names and visible focus. |
| Q5 | Tab/Shift+Tab at both ends of the tray; open a font panel and Escape; close tray. Start a session/profile action | Focus stays in the dialog and skips inert controls during mutation. Child Escape closes that panel alone. Closing restores opener focus and background interactivity. Progress announcements remain exposed. |
| Q6 | With an existing override, change Vowels and immediately Save as defaults; repeat with Revert and repeated action clicks | The setting write finishes first. Save includes the latest choice; a late write cannot undo Revert. Reopening confirms intended persistence; no duplicate mutation or stale insertability. |
| Q7 | Switch profile during a pending setting save; repeat with a controlled save/clear failure in the test deployment | The action waits through session clearing. A failed switch differs from a switched profile whose overrides could not be cleared; failures offer retry/Revert guidance. |
| Q8 | Cause two setting-save failures in the test environment; restore connectivity and change another option. Repeat with Revert | One automatic retry, then insertion/new passage fetches pause. The complete visible snapshot remains recoverable. A new choice retries it; Revert discards it. No endless refresh polling or stale insertion. |
| Q9 | Confirm a partial edition over a cross-chapter range with an empty/short early fragment. Compare Sefaria and Line by line with numbering on/off | Pairing/notes keep chapter and verse coordinates; missing cells stay blank and numbering restarts correctly. Record exact live fixture. Offline controlled example: `Genesis 1:31–2:2`. |
| Q10 | Stacked + Line by line, several editions with different chapter coverage, transliteration enabled | All editions share the Hebrew chapter/verse positions; pointed source coordinates match. A gap never shifts later words or another edition's notes. |
| Q11 | Insert an available whitespace-significant edition, such as catalog title `The Philosophical Tanakh `, alongside another; follow linked titles | Exact identity survives fetch, result and pinned URL. Record title/URL with significant whitespace. Whitespace-distinct returned titles cannot substitute. |
| Q12 | Confirm a one-language source (check current `Siddur Rashi 1`). Choose the missing Display language; repeat via Selection and Link Texts defaults | Sidebar disables Add Source with guidance and recovers with the usable language or Both. Other entry points fail before document changes; selected citation survives. Both has no empty block. |
| Q13 | Confirm a segment emptied by Commentary/Notes. Insert it with another translation, then change options to restore its content | Empty block omitted with explanation, edition remains selectable. All-empty output fails before editing. Only truly unavailable editions affect availability. Record exact fixture/options; synthetic test data does not establish a live fixture. |

Record Q results in the same Results table as N/O/P. Browser layout, native
keyboard traversal, actual Apps Script execution and tutorial recordings
remain separate from source/test verification.

---

## Reporting back

For anything that fails, the useful report is:

1. The check id
2. What you saw versus what the table says
3. **Browser console output** — most of the failure modes here (SRI, CSP,
   `google.script.run`) show there and nowhere else
4. Which account (A upgrading / B fresh / C from version 1.0), the
   interface (Simple / Everything) and the scan mode in effect

State the version too: **2.0.0, schema 34**, and the exact tested commit. "It broke" is not checkable
later; the version and the check id are.

---

## Results

Record each run here and commit it with the release, so there is evidence the
checklist was run against the code that shipped.

| Date | Tester | Account (A/B/C) | Apps Script version / commit | Result | Failures (check ids) |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

### Q — selection and onboarding follow-up (pending live verification)

| Case | Action | Expected |
| --- | --- | --- |
| Q1 | Highlight an entire paragraph containing Beresheet 1:1-2; choose Insert Source from Selection | Review or prefilled Texts fallback, not empty-selection error; no edit until confirmation |
| Q2 | Select two references with quiet linking saved | Both reviewed, Insert defaults on for exact matches, ambiguous rows require choice; quiet setting unchanged |
| Q3 | Select only the second of two identical citations; link; then repeat after an earlier edit or tab switch | Only the intended occurrence linked; stale selection fails safely |
| Q4 | Select part of a paragraph and multiple paragraphs or table cells; Link Texts in both scan modes | Only selected text uploaded/linked, or clear failure if the body mapping cannot be verified |
| Q5 | Gematriya Count on a selected full paragraph and without selection | Correct selection and document counts |
| Q6 | Fresh setup, choose 1.0 and Continue | Immediate completion, Add Sources with Sefaria, no Voices/Lexicon tabs or menu entries; quiet linking, no automatic name transform |
| Q7 | Other paths with each combination of optional tools | Saved checkboxes and matching menu labels after finish |
| Q8 | Each Help submenu command and tab-styled rerun button | Correct tab; wizard keep/reset choice, not overlapping dialogs |
| Q9 | Rerun Keep then Reset on test account with custom preferences and named profiles | Keep retains untouched values; Reset restores active defaults, retains saved profile snapshots and consent |

### R — preference controls and profile transfer (pending live verification)

| Case | Action | Expected |
| --- | --- | --- |
| R1 | Disable Voices and Lexicon in Sidebar; Save; switch Simple → Everything → Simple | Both remain absent from sidebar/menu and editor; Add Sources with Sefaria stays the Texts label; unrelated preferences unchanged |
| R2 | Edit vowels or typography without saving; switch interfaces | Form edits remain unsaved and intact; only the mode-driven menu baseline is updated |
| R3 | In Everything, click the pencil above Profiles and rename | Renames only the current profile; tooltip and accessible label; no apparent profile row named Rename |
| R4 | In Simple, open Import/Export; export and import a file | No profile picker; active preferences updated; Simple stays active |
| R5 | In Everything, choose an inactive profile; export with a different unsaved active font | File uses saved inactive values, not the active form; no profile switch |
| R6 | Import only Text and layout into inactive profile while active form has edits | Inactive profile updated; active edits and other groups untouched |
| R7 | Import shared settings with and without opt-in | Shared keys excluded unless enabled and group checked; mode unchanged |
| R8 | Close with Escape or close button; reopen and change target after file preview | Focus returns to Import/Export; target change refreshes preview |
| R9 | Open transfer dialog, then change active profile in another document | Stale identity rejected; no preference writes |

### S — shared insertion control parity (pending Docs verification)

| Case | Action | Expected |
| --- | --- | --- |
| S1 | In Preferences, open Insertion → Insertion Defaults → Texts in Simple and Everything | Notes sits directly below Commentary, with Separate / Inline / Omit and one selected value. Both rows show ⓘ help on hover and keyboard focus. Repeat in the sidebar at its default narrow width and check the Commentary label and icon have separate space. |
| S2 | Save Notes: Inline, open sidebar Text and notes; change to Separate for the session, reopen Preferences | Sidebar starts Inline; Separate is temporary until Save as defaults; Preferences still shows Inline. Save as defaults, reopen, verify Separate. |
| S3 | Compare all shared controls in Preferences and sidebar; change Display to Original, Both, Translation | Notes remains applicable in each; Preferences keeps defaults editable for other display choices; sidebar hides only inapplicable or explicitly disabled controls. |
| S4 | Switch saved profile and use Import/Export or Reset to Defaults; inspect Notes and other shared options | Notes follows the active saved profile or defaults. In a document inheriting the account menu, Restore Factory preset returns Notes to Separate and the menu starts with Add Sources with Sefaria, Link Texts with Sefaria, and Transform Divine Names in that order, followed by Preferences and Help. |
| S5 | Run Link Texts → Customize this insertion; choose Notes with either language | Notes is available outside the language sections and applies only to the pass until Save as defaults. |
| S6 | Reopen the sidebar several times, including after a warm load. Trigger an operation from the Extensions menu and again from the sidebar where available | Controls respond on every open. Record when Google Docs displays its own script-status toast and whether the add-on provides operation-specific feedback. |

### T — repeated citation detection (pending live verification)

| Case | Action | Expected |
| --- | --- | --- |
| T1 | No selection: repeat Genesis 1:1 on three lines and in a sentence; run Link Texts in both scanning modes and review modes | Every unlinked occurrence is represented and can link independently, not just the first. |
| T2 | Repeat בראשית א:א in a Hebrew document, with the first occurrence already linked | Remaining copies are linked; existing link untouched. |
| T3 | Include Genesis 1:10, Genesis 1:1-2, Rashi on Genesis 1:1, and ambiguous/ibid citations | Never link a substring or copy a context-dependent/ambiguous resolution. |
| T4 | Select only two repeated citations; run Link Texts or Insert from Selection | Only occurrences inside the selection are eligible. |
| T5 | Run review and quiet linking again after linking all repetitions | Previously linked occurrences remain untouched; no duplicate link rows. |
| T6 | Use a document with a linked `בראשית א׳:א׳-ב׳` heading, Hebrew body text, and three unlinked `Genesis 1:1-2 (Edition name)` headings. Run Link Texts without a selection, reset, then repeat with the whole block selected and again with only the English text selected. Test both scan modes | All three English citations link at their own positions, the edition names stay plain, and the existing Hebrew link stays intact. Selected scans leave anything outside the selection untouched. |

### U — keyboard and screen reader

Record the deployed Apps Script version, browser, operating system, and screen reader for each run. Run keyboard-only first, then repeat with NVDA and Chrome on Windows and VoiceOver and Safari on macOS where available.

| Case | Action | Expected |
| --- | --- | --- |
| U1 | Open the sidebar at its default width. Use Alt + / (Option + / on Mac), submit a search, and move through results from the field. Use Tab to move through a result row. | The shortcut focuses search. The highlighted result is announced with its position. Preview, pin, and open on Sefaria are separately named controls. Selecting a result moves focus to Show results when the list collapses. |
| U2 | Use arrows on the sidebar’s result type and on Preferences and Help tabs. Include hidden modes in the Preferences fixture. | The selected mode or tab is announced. Hidden choices are skipped. In a tablist, one tab is in the Tab sequence and its panel has the matching name. |
| U3 | Open Insertion Options, focus the two ⓘ buttons, and press Escape. Open a sidebar notice, a Preferences confirmation, and Import/Export. Check Tab, Shift + Tab, Escape, and cancellation. | Tooltips are described and dismiss before the tray closes. Modal focus remains inside while open and returns to the opener after dismissal. Keyboard shortcuts cannot trigger insertion behind a dialog. |
| U4 | Preview original and translated text with transliteration. Trigger a recoverable preview error and take Link Texts through review and completion on a disposable document. | Hebrew and Latin transliteration expose language information. Status or error text is announced without reading the whole preview. Link Texts moves focus to the active review, progress, or completion message. |
| U5 | Open a populated Session Library. Use a filter, select a reference, and exercise the standalone dialog and sidebar fallback. | The selected filter remains focused and announced after it redraws. Open, pin, and remove are distinct controls. Closing the fallback returns focus to the Session Library button. |
| U6 | Re-run Setup, open Feedback, and enter and leave the add-on from the Docs editor. | Each add-on page has a useful title and heading. Check focus as it crosses the Docs frame boundary and confirm the external feedback link is reachable. |
