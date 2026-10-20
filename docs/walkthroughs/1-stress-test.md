# Walkthrough 1 — Stress test

**Audience:** the maintainer and anyone doing QA before the add-on goes to
Sefaria. **Time:** 2–3 hours. **Goal:** find what breaks, not show what works.

This goes further than [`docs/live-test-checklist-2.1.0.md`](../live-test-checklist-2.1.0.md).
That checklist asks whether each 2.1 change landed. This walkthrough
deliberately does things a real user will eventually do by accident: odd cursor
positions, awkward references, editing while a dialog is open, old
preferences, slow networks. Run the checklist first; start this once it passes.

Every step has three parts:

- **Do**: the action.
- **Expect**: what should happen.
- **Watch for**: the failure that is most likely, or most damaging if it
  happens.

A step "fails" if the result differs from **Expect**, *or* if the add-on does
something wrong without saying so. For this add-on the worst bugs have been
silent ones: an empty panel that looks like a gap in Sefaria's library, or a
count that leaves out what went wrong. When something goes wrong, the add-on
should say so.

---

## Known suspects going in

Found while writing this walkthrough, by reading the code. K1–K5, K8 and K9
are fixed on this branch, each with a pinning test; the steps below now check
the fixed behaviour. K6 and K7 are left as they are: the published add-on
stores no preferences, so there is nothing to carry over.

| # | Was | Fix | Status |
| --- | --- | --- | --- |
| K1 | **English verse numbers reset across a chapter boundary.** `Genesis 1:31-2:3` with line numbers on read (1), (1), (2), (3) in English; the Hebrew was right. | `formatDataForPesukim` keeps a separate verse counter per language, and each chapter gets a heading line (*Chapter 2* / *פרק ב*). | **Fixed.** `format-data-for-pesukim.test.js`. Step 3.2. |
| K2 | **A slow linker scan read as "nothing found".** Polling gave up after about 5 s and returned an empty result; so did a network error. | Polls for about 30 s, then says Sefaria was still scanning; network errors say Sefaria couldn't be reached. | **Fixed.** `sefaria-unavailable.test.js`. Step 7.9. |
| K3 | **Linker offsets went stale if the document changed before Apply.** | Each match records which occurrence of its text it is; Apply re-finds it, and reports citations that are gone. | **Fixed.** `linker-classify.test.js`. Step 7.7. |
| K4 | **Insert from a table** (linker per-row Insert, and the cursor in general). The cursor path in fact put the source at an unrelated place in the body, silently, for texts, sheets and lexicon alike. | One resolver for every insert path (`server/insertion-target.gs`): paragraph layouts go inside the cell; Right–Left / Left–Right go below the table with a notice; headers, footers and footnotes are refused with a message. | **Fixed.** `insertion-target.test.js`. Steps 2.5–2.8, 7.4, 8.4. |
| K5 | **Network failure read as "no match".** | `findReference` throws "Couldn't reach Sefaria…" for no response, 5xx and 429; an unknown reference is still "no match". | **Fixed.** `sefaria-unavailable.test.js`. Step 11.1. |
| K6 | Original-add-on users' stored preferences. | — | **Not applicable**: the published add-on stores no preferences. |
| K7 | Legacy `nekudot_filter="tanach"`. | — | **Not applicable**, as K6. |
| K8 | **"Vowels only in Tanakh" had no control**, and toggling Vowels reset it. | **Vowels** is a three-way control, **Off / Tanakh / On**, in the composition card (Insertion Options, Preferences → Insertion, Link Texts); *Tanakh* is its own choice, so nothing resets it. Cantillation likewise: **Off / Tanakh / Torah**. | **Fixed.** `vowels-tanakh-only.test.js`. Steps 5.9, 5.9a. |
| K9 | **Link Texts' Insert repeated the citation.** The citation stayed, and the inserted source's title said the same thing on the next line; Insert from Selection replaced it. To insert one batch differently you had to cancel the review or change Preferences for good. | Insert follows *Insert from Selection replaces the selection*: a citation on a line of its own is replaced (title = the citation, link kept); one inside a sentence stays. The review dialog's **📰 Customize this insertion** panel sets the layout for one pass. | **Fixed.** `linker-insert-replace.test.js`, `linker-dialog.test.js`. Steps 7.4–7.4b, 7.18–7.25. |

Also found while fixing K4: every sidebar toast was invisible (CSS opacity).
Fixed; step 2.6 now depends on it.

---

## 0. Setup

### Accounts

| Account | What it is | Why |
| --- | --- | --- |
| **A — upgrader** | Had an earlier build of *this* add-on (2.0 or an early 2.1) with preferences you changed: a font, a divine-name rule, a layout. | Proves the migrations keep what users chose. |
| **B — fresh** | Has never installed any version. | Proves `onInstall` seeding and the first-run experience. |
| **C — original-add-on user** | Has the published *Sefaria for Google Docs* installed (menu: *Insert Source / Search Texts / Preferences / Support / Popcorn (beta)*). | Proves the path most Sefaria users will take. |

### Instruments

- Browser console open on every run.
- Apps Script editor → **Executions** open in another tab. Every server call
  shows there with its duration and any `Logger.log` output.
- A stopwatch. Apps Script stops any execution at 6 minutes. Anything past
  about 30 s is a UX bug even if it eventually succeeds.

### The stress document

Make a new Doc and build it exactly as follows. The structure matters more than
the prose.

1. **Heading 1:** `Stress document`
2. Normal paragraph: `A clean citation: Genesis 1:1.`
3. Normal paragraph: `Two in one line: Exodus 20:1 and Deuteronomy 5:6.`
4. Normal paragraph: `Ambiguous: Avodah Zarah 2a.`
5. Normal paragraph: `Nonsense: Fakebook 99:99.`
6. Normal paragraph: `Hebrew: שמות כ:א and ברכות ב.`
7. Normal paragraph: `Traditional: Hil. Shabbat 1:1 and Rambam, Hil. Teshuvah 3:4.`
8. Normal paragraph: `Split formatting: ` then type **Genesis** in bold and ` 2:1` in plain text.
9. Normal paragraph: `Already linked elsewhere: Psalms 23`. Link `Psalms 23` to `https://example.com`.
10. A **bulleted list** with two items: `Leviticus 19:18` and `Numbers 6:24`.
11. A **2×2 table**. Put `Isaiah 40:1` in one cell and ordinary words in the others.
12. A **footnote** (Insert → Footnote) on paragraph 2 containing `Proverbs 3:17`.
13. A **header** (Insert → Headers & footers) containing `Ruth 1:16`.
14. About 250 characters of plain prose with **no** citation, then a paragraph
    `Isolated: Micah 6:8`, then another 250 characters of prose.
15. Two paragraphs of ordinary prose with no citations.

Keep a pristine copy and make a fresh copy for every run of section 7.

---

## 1. Install and first open

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 1.1 | **B:** install from a Doc; open **Extensions** without reloading. | Menu present; first-run setup opened (*Step 1 of 3*), not the release notes. | No menu until reload (the regression pinned in `triggers.test.js`). |
| 1.1a | **B:** click **Continue** through setup without changing anything; then **Help → Run setup again** and **Skip for now** | Nothing stored but "setup done"; the sidebar opens in the mode shown. Setup is never shown again on its own. Saving shows a spinner. | Preferences changed by clicking through; setup shown to account **A** (an upgrader never sees it). |
| 1.2 | **B:** open a second Doc in a new tab *before* doing anything in the first. | Menu builds in the second Doc too. | Menu missing or partial. In `AuthMode.NONE` the menu is built from the default layout without reading preferences. That is expected; a missing menu is not. |
| 1.3 | **B:** open Preferences straight away. | Every field shows a value. Colours read **Auto / None**. Divine Name Mappings: יהוה → יי on, others off. | Blank fields, black swatches, or `undefined` anywhere (seeding missed a key). |
| 1.4 | **A:** open a Doc. Open Preferences. | Everything you set before the upgrade is unchanged. | Anything reset to a default. Compare against a screenshot taken before the upgrade. |
| 1.5 | Open the sidebar in two Docs at once, same account. Change Display or Arrangement in 📰 Insertion Options in one. | The other sidebar is unaffected (session state is per sidebar). | Settings bleeding between sidebars. |

---

## 2. Where the cursor is

Insert `Genesis 1:1`, Hebrew + English, from each position. After each one,
undo with <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Z</kbd> and note how many undos
it took.

| # | Cursor / selection | Expect | Watch for |
| --- | --- | --- | --- |
| 2.1 | Very start of the document | Inserted below the first paragraph, or at the top. Note which. | Inserted at the end of the document instead. |
| 2.2 | End of the document | Inserted at the end. | An extra blank paragraph piling up with each insert. |
| 2.3 | A completely empty new Doc | Inserted. Fonts match the document default (Arial 11 in a new Doc). | Error, or an odd font because there was no text to match. |
| 2.4 | Inside the Heading 1 | Title and body get their own styles, **not** Heading 1. | The whole source inherits the heading style. |
| 2.5 | Inside a bulleted list item | Inserted after the list item. | Inserted *as* list items, with bullets on every verse; or inserted after the first paragraph of the document (the old cursor-index bug). |
| 2.6 | Inside a table cell: insert once with Hebrew only, once Stacked, once **Right–Left** | Hebrew only and Stacked go **inside the cell**, under the cursor's line. Right–Left goes **directly below the table**, and a message at the bottom of the sidebar says why. | The source anywhere else in the document; no message for Right–Left; a table nested in the cell. Repeat from a Voices sheet and a Lexicon entry: both go inside the cell. |
| 2.7 | In the header, then the footer | A message asking you to click in the main text. Nothing inserted. | Inserted into the body with no explanation. |
| 2.8 | In a footnote | The same message. | A script error, or an insert into the body. |
| 2.9 | A selection across three paragraphs (no Insert-from-Selection, just Add Source) | Inserted after the selection; the selection is left alone. | Selected text deleted. |
| 2.10 | An image selected | Inserted after it, or a clear message. | Script error. |
| 2.11 | The Doc in **Suggesting** mode | Note whether the insert shows as a suggestion or a direct edit. Apps Script edits usually land as direct edits. | Worth knowing before a reviewer asks. Record the behaviour; it may belong in Help. |
| 2.12 | A Doc you can only **view** or **comment** on | A clear message that the Doc can't be edited. | Silent no-op. |
| 2.13 | Double-click **Add Source** quickly, then press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> three times quickly | One insert per deliberate action. | Two or more copies from one double-click. |

---

## 3. References that are awkward to resolve

For each, type it in the Texts search, select the top result, look at the
preview, then insert.

| # | Query | Expect | Watch for |
| --- | --- | --- | --- |
| 3.1 | `Genesis 1:1-5`, **Line numbers** on, both languages | Verses numbered 1–5 and א–ה. | Numbers off by one. |
| 3.2 | `Genesis 1:31-2:3`, **Line numbers** on, both languages | English (31), (1), (2), (3); Hebrew לא, א, ב, ג. A heading line at the break in each language (*Chapter 2* / *פרק ב*). | **K1 (fixed):** English reading (1), (1), (2), (3). Numbers restarting with nothing to say a new chapter began. |
| 3.3 | `Genesis 1:31-2:3`, **Line numbers** off | Verses joined as prose with single spaces; nothing lost at the chapter break. | Words run together at the boundary (`...good.The heaven...`). |
| 3.4 | `Berakhot 2a:5-2b:2` | Spans the amud break; readable. | Missing segments or a doubled segment at the break. |
| 3.5 | `Psalms 119` (176 verses), both, **Line numbers** on | Inserts in well under 30 s. | Timeout, or a sidebar stuck on the spinner. Time it. |
| 3.6 | `Genesis` (whole book) | Not insertable; the sidebar says to pick a passage and **Add Source** is disabled. | A 50-chapter insert, or a timeout. |
| 3.7 | `Mishneh Torah, Shabbat 1:1` and `Hil. Shabbat 1:1` | Both resolve to the same passage. | The abbreviated form resolving to something else. |
| 3.8 | `Hil. Avodah Zarah 12:11` | Mishneh Torah suggested **first**; the Talmud tractate lower. | The tractate first (an abbreviation silently retargeted). |
| 3.9 | `Shulchan Arukh, Orach Chayim 1:1` | Resolves. Note whether commentary text appears (it shouldn't; `commentary=0`). | Commentary mixed into the body. |
| 3.10 | `Rashi on Genesis 1:1:1` | Resolves. Bold heading words (דיבור המתחיל) stay bold. | Raw `<b>` tags, or emphasis flattened. |
| 3.11 | A Siddur node: search `Siddur Ashkenaz` and drill in | Structural levels explain they aren't insertable; a leaf inserts. | A structural node that inserts nothing, or throws. |
| 3.12 | `Zohar 1:1a` | Resolves or gives a clear no-result message. | Blank panel. |
| 3.13 | `בראשית א׳:א׳`, `ברכות ב.`, `רמב״ם` | Resolve or suggest. | Nothing at all (the gershayim bug class). |
| 3.14 | `A Woman's Commentary`, `Jacob's Ladder`, `don't`, `P'sukei D'Zimra` | No mangling. P'sukei still finds Pesukei DeZimra. | `Womanes`, `Jacobes`, `donet`. |
| 3.15 | `the torah a womens commentary deuteronomy 29 9-14` | Resolves to *The Torah; A Women's Commentary, Deuteronomy 29:9–14*. | No result (punctuation-exact title matching). |
| 3.16 | `Genesis 1:1` pasted with a leading tab and trailing newline | Resolves. | Whitespace breaks lookup. |
| 3.17 | `https://www.sefaria.org/Genesis.1.1?lang=bi&with=all` | Resolves to Genesis 1:1. | The query string breaking the parse. |
| 3.18 | `https://sefaria.org.evil.example/Genesis.1.1` | **Not** treated as a Sefaria link. | Accepted as a Sefaria URL. |
| 3.19 | `qqqq zzzz`, a 500-character paste, `🙂🙂`, `<img src=x onerror=alert(1)>` | An explicit "no results" message naming what to try. Nothing executes. | Blank panel, an alert box, or a console error. |
| 3.20 | Type `Deuteronomy ` (with the trailing space) slowly, then edit the middle of the query | The box keeps exactly what you type; the caret stays put. | The trailing space disappearing, or the caret jumping to the end. |
| 3.21 | `Psalm 23` vs `Psalms 23` vs `Tehillim 23` | All resolve. | `Pesalms` in the Executions log or the "Did you mean" line. |
| 3.22 | Click **‹ Prev** on `Genesis 1:1` and **Next ›** on the last verse of Deuteronomy | Sensible stop, or a move to the neighbouring book. | Script error or a blank card. |

---

## 4. Versions and multiple translations

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 4.1 | `Genesis 1:1`, **Translation** only; <kbd>Ctrl</kbd>-select three translations; insert. | Three blocks, in the order clicked, a blank line between each, one title each naming its version **once**. | A version named twice; blocks run together. |
| 4.2 | Same, with the Translation section's **Link title to Sefaria** on | Each title opens *that* translation on sefaria.org. | Every link opening the default translation. |
| 4.2a | Both languages, Stacked. Source section's **Link title to Sefaria** on, Translation's off; insert. Then the reverse | Only the Hebrew title linked, then only the translation title. Each title keeps its own **Title font** whether linked or not; a linked title takes Preferences → Fonts → Title's linked style only while that title's **Hyperlink formatting override** is on (the default). | One switch linking both titles; a linked title losing its font with the override off. |
| 4.3 | Add a translation that doesn't cover the verse (a partial translation) to the multi-select | Skipped, reported, and greyed out *unavailable for this ref*. | An empty block, or a duplicate of the default translation. |
| 4.4 | Multi-select, then switch Arrangement to **Right–Left** | Blocked, or reduced to one translation with a message. | Several translations crammed into one table cell, or silently dropped. |
| 4.5 | Preferences → Fonts → Translation → preferred language **French**; search `Genesis 1:1` | A French translation if one exists; otherwise a fallback that is clearly labelled. | English inserted with no indication. |
| 4.6 | Pick a non-default **Original Versions** Hebrew edition; insert Hebrew only | The credit block names *that* edition and its license. | The credit naming the default edition. |
| 4.7 | Insert a text whose translation license is CC-BY-NC | License shown in the credit block. | No license, or "undefined". |

---

## 5. Formatting and typography

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 5.1 | Doc's Normal text set to Georgia 14 (Format → Paragraph styles → Update). All font roles on **Match the document**. Insert. | Hebrew, translation and title in Georgia 14. | Arial 11 anywhere. |
| 5.2 | Cursor after a paragraph manually set to Courier 9 (not via the style) | Matches the paragraph at the cursor. Note whether that's what a user would expect. | Inconsistent matching between roles. |
| 5.3 | Title style → **Heading 2**; insert three sources; Insert → Table of contents | All three titles in the TOC. | Title font forced over the heading style. |
| 5.4 | Set a translation text colour and highlight; insert; reset both to **Auto/None**; insert | Applied, then not applied. | Colour sticking after reset; black text forced. |
| 5.5 | File → Page setup → a dark page colour; insert with default colours | Text inherits the document; nothing forced black. | Black text on the dark page. |
| 5.6 | Source Emphasis → Advanced: bold → blue, no bold. Insert `Berakhot 2a` (Steinsaltz) | Talmud words blue, not bold. | Nothing blue; or the title also blue. |
| 5.7 | Source Emphasis → **Discard**; insert the same | Flat text. | Leftover bold. |
| 5.7a | 📰 Insertion Options → Translation section → **Bold & italics** → **Only**; insert `Berakhot 2a` both languages, then translation only | Translation: only the bold words (the Talmud's own), line markers kept, lines with no emphasis left out. The Hebrew/Aramaic is inserted whole, with its own bold (מֵאֵימָתַי) kept. | Empty insert; Steinsaltz's explanation left in; Hebrew cut down to its bold words. |
| 5.7b | **Bold & italics** → **Drop**; insert `Mishnah Berakhot 1:1`, both languages | Translation flat; the Hebrew's opening מֵאֵימָתַי still bold. | The Hebrew's bold dropped too (the setting is the translation's only). |
| 5.8 | Vowels **Off**, Cantillation **Tanakh**; insert `Genesis 1:1` | Cantillation kept, vowels gone, sof pasuq **׃** and paseq **׀** kept. | Punctuation stripped with the vowels. |
| 5.9 | Preferences → Insertion → **Vowels: Tanakh**; save. Insert `Mishnah Berakhot 1:1` and `Genesis 1:1`. Then click **Off** and **Tanakh** again, save, and reopen | Mishnah without niqqud, Genesis with. After reopening, **Tanakh** is still selected. | **K8 (fixed):** *Tanakh* lost when Vowels changed. |
| 5.9a | Cantillation **Torah**; insert `Genesis 1:1` and `Isaiah 40:1`. Then **Tanakh** | *Torah*: marks on Genesis only. *Tanakh*: on both. An account that had an old stored `"torah"` shows **Tanakh** (schema 24 rewrote it). | Torah-only applied to Isaiah; an upgrader's setting changing meaning. |
| 5.9b | In 📰 Insertion Options click **Vowels: Off**, then at once a switch (Punctuation), then **Add Source** as soon as it enables | Preview says *Updating preview…* at once; Add Source stays disabled until the save and re-fetch land; the insert has no vowels. | The preview right but the insert with vowels (the lost-Vowels bug); Add Source enabled mid-save. |
| 5.9c | Click one switch three times quickly | It ends where the clicks left it, with no flicker back to an earlier state. | A switch flipping back, or ignoring a click. |
| 5.10 | Source section → **Transliteration** on; pick each **Style**; insert `Genesis 1:1` each time | *Style* shows only while the switch is on. Transliteration present and different per scheme; font follows the Transliteration role. With Display **Both** or **Translation** the tray scrolls down to *Style* and the Translation section. | Transliteration in the Hebrew font; an empty line; *Style* cut off at the bottom of the tray. |
| 5.10a | Source section → **Punctuation** off, Vowels **Off**, Transliteration on; insert `Genesis 1:1` | Transliteration fully vowelled (read from Sefaria's text, not the stripped Hebrew), no sof pasuq, maqaf as a space (*kol ha'am*). Same in the preview and the card's sample. | Bare consonants; *kol-ha'am*; a stray ׃. |
| 5.11 | Insert a text with `&thinsp;` in the Hebrew (Talmud or Mishnah with thin spaces) | No literal `&thinsp;`, `&nbsp;` or `&…;`. | Any literal entity. |
| 5.12 | **💾 Save as defaults** at the top of 📰 Insertion Options while Preferences is open in a dialog; then **Save Defaults** in the dialog | The last save wins. Decide whether that's acceptable, and whether the dialog should warn. | Silent revert of the sidebar save. |
| 5.13 | Preferences → Fonts → **Citation**: a font, 10 pt, bold, a colour; save. Insert with **Citation** on. Then *Same as the text above* and a blank size | The credit line in that style; then the font and size of the passage above it, italic 8 pt as before for an untouched account. | The citation ignoring its style; an upgrader's citation looking different before they touch it. |
| 5.14 | Font buttons: Source **Text font** → David Libre; Cantillation **Tanakh**; insert `Genesis 1:1` | Letters and vowels in David Libre; only the cantillation marks in Noto Serif Hebrew. The sample in the card looks the same. No font UI mentions borrowing. | Empty boxes; the whole verse in Noto. |

---

## 6. Divine names

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 6.1 | Default rules; insert `Genesis 2:4` | יהוה → יי, including with a prefix (ליהוה, ביהוה). | Prefix forms missed. |
| 6.2 | Turn on יה; insert `Genesis 29:35`, `Exodus 15:2`, `Psalms 150:6` | יְהוּדָה intact; standalone יָהּ replaced; הַלְלוּ־יָהּ replaced. | יהודה → קהודה. |
| 6.3 | Replacement text `$&-$1` | Inserted literally. | The pattern expanded. |
| 6.4 | English *God* → `G-d`; insert a text with *God's*, *Godly*, *gods*, *GOD* | Decide which should change; record what does. | *Godly* → *G-dly* is probably unwanted; *gods* changed would be wrong. |
| 6.5 | Type יהוה into the table cell, the header and a footnote; run **Transform Divine Names** | Note which places are transformed. | Body only, with no mention of it. |
| 6.6 | Run **Transform Divine Names** twice | The second run changes nothing. | Replacing inside its own replacement. |
| 6.7 | Turn the master switch **off**; insert `Genesis 2:4` | יהוה unchanged. | Replacement still applied. |

---

## 7. Link Texts with Sefaria

Use a **fresh copy** of the stress document for every row that says so.

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 7.1 | First run ever on the account | One-time confirmation naming the active scan mode. Decline → nothing sent, nothing changed. | Anything sent before the answer (check Executions). |
| 7.2 | Run, accept (Candidate passages) | Dialog opens immediately with a scanning state; then a summary: auto-linked, need a choice, could not be resolved, fell across a gap. | A frozen menu for several seconds with no dialog. |
| 7.3 | Review the table | Paragraphs 2, 3 (both), 6, 7, 10 (both items) found. Avodah Zarah is a dropdown with excerpts, Link unchecked. Fakebook counted as unmatched; **▸ Show 1 citation that couldn't be matched** under the table lists it with the spelling searched and *Sefaria doesn't recognise the book name*. Psalms 23 (linked to example.com) **not** offered. | The paragraph 8 split-format citation, the footnote (12) and the header (13) are expected **misses** because the scan reads the body text only. Record whether any appear, and whether the report mentions them. |
| 7.4 | Tick **Insert** on the table citation (Isaiah 40:1) and on one list item; apply. Repeat with the default layout set to Hebrew only | Both citations are alone on their line, so each is **replaced** (Preferences → Insertion → *Insert from Selection replaces the selection* is on by default). Right–Left default: the Isaiah source goes below the table, the done message says why, and the cell is left empty. Hebrew only: the source takes the citation's place inside the cell. The list item becomes the source. Your cursor doesn't move. | **K4 (fixed):** the source at the end of the document, or no explanation. A citation left behind with the same words repeated as the title below it (**K9**). |
| 7.4a | **Fresh copy.** Tick **Insert** (and **Link**) on `Leviticus 19:18`; apply. Click the inserted title | The list item is replaced by the source, titled `Leviticus 19:18` exactly as typed, and the titles link to Sefaria even if both *Link title to Sefaria* switches are off in Preferences (the citation was linked). | The citation and a second `Leviticus 19:18` title (**K9**). A replaced citation that loses its link. |
| 7.4b | **Fresh copy.** Turn off *replaces the selection* in Preferences; repeat 7.4a | The citation stays (linked) and the source goes below it, titled with Sefaria's reference. | The citation deleted anyway. |
| 7.5 | Tick **Insert** on *both* citations in paragraph 3; apply | Two sources below paragraph 3, Exodus above Deuteronomy. | Wrong order, or one inserted inside the other. |
| 7.6 | Pick the second Avodah Zarah candidate; apply; click the link | It opens the candidate you picked. | It opens the first candidate. |
| 7.7 | **Fresh copy.** Run; while the review table is open, type a sentence at the top of the Doc and delete `Exodus 20:1` from paragraph 3; then Apply | Links land on the right words. The done message says one citation changed or disappeared and was left alone. | **K3 (fixed):** links shifted by the length of what you typed; Exodus's link landing on other text. |
| 7.8 | Run again on the linked copy | Nothing already linked is offered again. | Double links; the counts inflated by already-linked items. |
| 7.9 | **Fresh copy**, Preferences → Linking → **Whole document**. Paste the stress document ten times (about 30 KB, about 150 citations). Run | Finishes with a full report, or, if Sefaria takes more than about 30 s, a message saying it was still scanning. | **K2 (fixed):** "no citations found" on a document full of them. |
| 7.10 | Keep pasting until the body is over 100,000 characters; run in Whole document mode | An explicit message naming the 100,000-character limit. | A silent "0 references" or a timeout. |
| 7.11 | Same large document in **Candidate** mode | Scans; the payload is well under the limit. | The limit hit anyway. |
| 7.12 | Paragraph 14 (Micah 6:8 isolated by prose) in Candidate mode | Linked, or counted as "fell across a gap" with the Whole-document remedy named. | Silently absent. |
| 7.13 | After linking → **Just link and report a count** | No dialog; an alert with linked / skipped / unresolved counts. | A count of successes only. |
| 7.14 | Same, with **Insert text after linking** on | Each linked source inserted; the alert counts insertions. | Insertions in the wrong place (see 7.4). |
| 7.15 | Close the dialog while **Applying…** is in progress | Whatever was applied stays applied; no half-link on a word. | A link covering part of a word. |
| 7.16 | Start the linker in two tabs on the same Doc | Both finish; no duplicate links. | Doubled links. |
| 7.17 | **Unlink Sources** | Every sefaria.org link removed; the example.com link on Psalms 23 kept. | Non-Sefaria links removed. |

### Customize this insertion

The review dialog's **📰 Customize this insertion** panel, under the table. Use
a **fresh copy** for each row. Before starting, note your Preferences →
Insertion settings and the sidebar's 📰 Insertion Options panel.

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 7.18 | Run; open the panel without changing anything | Collapsed by default. Opened, it shows the same controls as the sidebar's 📰 Insertion Options (Layout, then Insertion Format with folded Source and Translation sections), set to your **Preferences** (not the sidebar's session choices), and says *Your defaults*. Revert and Save are disabled. | Session choices from the sidebar; blank controls; the panel missing entirely (it stays hidden only if Preferences couldn't be read). |
| 7.19 | Set Display **A + א**, Arrangement **Stacked**, Vowels **Off**, **Line numbers** off, Bold & italics **Drop**; tick **Insert** on paragraph 3's two citations and `Leviticus 19:18`; apply | All three sources: no vowels, no line numbers, the translation without bold (the Hebrew keeps its own). The panel said *Customized for this pass*. Afterwards Preferences → Insertion and the sidebar's 📰 Insertion Options are unchanged. | Any source with your defaults instead; Preferences changed without **Save as defaults**. |
| 7.20 | Display **A** (translation only), then **א** | **A**: Arrangement and the Source section (Vowels, Cantillation, Transliteration…) are hidden; Citation, Line numbers and the Translation section stay. **א**: the Translation section is hidden. Back to **A + א** shows both. | Hebrew controls offered for a translation-only insert. |
| 7.21 | Untick **Replace a citation on its own line**; insert `Leviticus 19:18` | The citation stays and the source goes below it. Preferences' *replaces the selection* is still on. | The citation removed; the preference turned off. |
| 7.22 | Change two settings, then **↺ Revert to defaults** | Everything back to Preferences; *Your defaults*. | A setting left changed. |
| 7.23 | Change Vowels; **💾 Save as defaults**; reopen Preferences | A spinner covers the dialog (*Saving…*) until the server answers. Preferences → Insertion shows the change; nothing else changed. The panel says *Your defaults*. | Other preferences overwritten; a silent failure (it should say *Could not save*). |
| 7.24 | Change a setting, tick **Insert** on several rows, **Apply**, and while it inserts click around the panel | Every source in the pass uses the settings as they were at **Apply**. | Sources in one pass with different layouts. |
| 7.25 | After linking → **Just link and report a count**, with **Insert text after linking** on | No dialog, so no panel: inserts use Preferences. | — |

---

## 8. Insert Source from Selection

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 8.1 | Select `Genesis 1:1` exactly in paragraph 2; run | The selection is replaced by the source, titled `Genesis 1:1`. | The remainder `A clean citation: .` Note what the sentence looks like afterwards and whether that's acceptable. |
| 8.2 | Turn off *replaces the selection*; repeat | Selection kept; source below the paragraph. | Source inserted mid-sentence. |
| 8.3 | Select across paragraphs 2 and 3 | A clear "no match" message, or the first reference. | Script error; both paragraphs deleted. |
| 8.4 | Select `Isaiah 40:1` in the table; then select across two cells | One cell: the citation is replaced, and the source goes in the cell (one language or Stacked) or below the table with a message (Right–Left). Two cells: nothing deleted; the source goes below the table, with a message saying the selection was kept. | Text deleted from several cells. |
| 8.5 | Select ordinary prose | *No Sefaria source matched "…"* | A random match inserted. |
| 8.6 | Select `בראשית א:א` | Resolves; Hebrew title. | No match. |
| 8.7 | Select `Hil. Shabbat 1:1` | Resolves via the abbreviation expansion. | No match. |
| 8.8 | Run it, then undo | Count the undos needed. Record it; Help could mention it. | Undo restoring only part of the change. |

---

## 9. Voices and Lexicon

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 9.1 | Voices: search `shabbat`; pick a sheet with images or video | Citation, Text, Both each insert; media become safe links. | Raw HTML; `javascript:` links; broken images. |
| 9.2 | A sheet with 60+ sources, **Both** | Finishes; time it. | Timeout. |
| 9.3 | A sheet that's only outside text (no Sefaria sources) | Inserts the text. | An empty insert. |
| 9.4 | Voices query with `<b>` or `"quotes"` | Snippets highlight without raw tags. | Tags visible; an alert. |
| 9.5 | Lexicon: `שלום`, `peace`, an Aramaic word, `שָׁלוֹם` with niqqud | Entries for each, or a clear no-result. | Niqqud breaking lookup. |
| 9.6 | Star an entry; open the sidebar in another Doc | Note whether stars persist across Docs. | Stars lost with no explanation. |

---

## 10. Session, preferences and menu state

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 10.1 | Leave the sidebar open over 6 hours (the session cache TTL); then change Display or Arrangement and insert | Works, perhaps with defaults restored. | A script error, or a silent insert with the wrong layout. |
| 10.2 | Incognito window (browser storage blocked or empty) | Sidebar works; Session Library and search history empty but not broken. | Console errors from `localStorage`. |
| 10.3 | Preferences → Menu Bar: hide every item you're allowed to; reload | Preferences and Help & Support still present, last. | An empty menu with no way back. |
| 10.4 | Menu Bar: nest items three levels; reload | Flattened or rejected clearly (Docs supports one submenu level). | A broken menu. |
| 10.5 | **Reset To Defaults** | Everything back to defaults, including יהוה → יי on. | Anything left over; `linker_upload_acknowledged` reset (it should **not** be reset). |
| 10.6 | Preferences → Experimental: enable, turn on Surprise Me, run it with every corpus off | "Choose at least one corpus." | Script error. |
| 10.7 | **🔁 Refresh** in Preferences | A spinner (*Refreshing the sidebar…*); the sidebar reopens from saved defaults, session choices cleared. | Silent no-op (the historical regression). |
| 10.7a | With the sidebar open on a selected source, change a font and Vowels in Preferences; **Save Defaults** | The open sidebar's Insertion Options and preview follow at once; a setting already changed for the session in Insertion Options keeps its session value. Saving shows *Saving preferences…* over the dialog. | Only the next insert picking up the change; a session choice overwritten. |
| 10.7b | Click ⚙︎ in the sidebar footer three times quickly (or *Colour, style and more…* in a font panel) | *Opening Preferences…* over the sidebar; one Preferences dialog. | Two dialogs; no feedback for several seconds. |
| 10.8 | Preferences → Insertion → **Layout**: hover each option; choose **A**; save; open the sidebar's 📰 Insertion Options | Both pickers (Display, Arrangement) are labelled segmented controls. Option names match the sidebar's (*Translation*, *Original with Translation*, *Original*; *Stacked*, *Right–Left*, *Left–Right*). In Preferences the Source and Translation sections start open. Insertion Options starts on **A**. | Different names than the sidebar; Layout hidden in Preferences; Insertion Options not following the saved default. |
| 10.9 | Preferences → **Interface: Simple**; reopen the sidebar; then **Everything** | Simple: no result sort or Restore Corpus, no Texts / Voices / Lexicon tabs while in Texts, no "More options"; Add Source, 📰 Insertion Options and the 📜 🏃 ⚙︎ footer buttons still there. Menu: Texts, Insert Source from Selection, Transform Divine Names, Link Texts, then Preferences and Help. Preferences hides Search, Linking and Experimental until **Show advanced settings**. Everything brings back your own menu. | Anything removed rather than hidden; your custom menu lost on the way back. |

---

## 11. Network and quota

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 11.1 | Disconnect the network (or block sefaria.org); search; click a result; Insert from Selection; Link Texts | Every one says Sefaria couldn't be reached. | **K5 (fixed):** "No Sefaria source matched", "Enter a valid reference" or "no citations found" when the real problem is the network. |
| 11.2 | Type a long query fast, with backspaces | Only the final query's results shown. | Results from an older keystroke replacing newer ones. |
| 11.3 | Throttle to "Slow 3G" in DevTools; insert `Psalms 119` | Spinner the whole time; completes. | A frozen UI with no progress. |

---

## 12. Accessibility and layout

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 12.1 | Use only the keyboard: <kbd>/</kbd>, type, <kbd>↓</kbd>, <kbd>Enter</kbd>, <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, <kbd>Esc</kbd> | A full search-and-insert without the mouse. | A focus trap in 📰 Insertion Options, a font panel or the Hebrew keyboard. |
| 12.2 | Browser zoom 200 % | Sidebar usable; nothing cut off horizontally. | Buttons off-screen. |
| 12.3 | OS dark mode | Sidebar and dialogs readable. | Dark text on a dark background. |
| 12.4 | Screen reader on the result list and the linker table | Rows and controls announced meaningfully. | "Button" with no label on icon buttons (🔍, 📜, 🏃, ⚙︎). |

---

## 13. Users of the original add-on (account C)

The published add-on stores no preferences, so an account that used it opens
this version as a new user would: it gets the defaults, and the migrations
run once.

| # | Do | Expect | Watch for |
| --- | --- | --- | --- |
| 13.1 | **C:** open a Doc that used the published add-on; open Extensions | The new menu; no error; no duplicate menu. | The old menu items still listed. |
| 13.2 | Open Preferences | Defaults: יהוה → יי on, colours Auto, Linking in Candidate mode. | Blank fields. |
| 13.3 | Insert `Mishnah Berakhot 1:1` | Niqqud appears. The published add-on removed it from every non-Tanakh text; walkthrough 4 warns about this. | — |
| 13.4 | Set **Vowels: Tanakh**; insert it again | No niqqud, as before. | The choice doing nothing. |
| 13.5 | Bilingual insert with defaults | A two-column table, Hebrew on the right: the published add-on's layout. | A different default layout. |

---

## Reporting

For each failure, record:

1. Step number (e.g. **7.4**) and account (**A / B / C**)
2. What happened versus **Expect**
3. Browser console output and the Executions entry (duration, error)
4. Scan mode and After-linking mode, for anything in section 7
5. Version: **2.1.0, schema 25** (plus the Unreleased changes in `docs/CHANGELOG.md`), and the commit you pushed

Anything under **Known suspects** that reproduces should get a row in
[`docs/regression-log.md`](../regression-log.md) and a pinning test when it's
fixed. K1–K5 and K8 already have rows and tests.

| Date | Tester | Account | Commit | Sections run | Failures |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
