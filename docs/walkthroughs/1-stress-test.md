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

Found while writing this walkthrough, by reading the code. K1–K5 and K8 are
fixed on this branch, each with a pinning test; the steps below now check
the fixed behaviour. K6 and K7 are left as they are: the published add-on
stores no preferences, so there is nothing to carry over.

| # | Was | Fix | Status |
| --- | --- | --- | --- |
| K1 | **English verse numbers reset across a chapter boundary.** `Genesis 1:31-2:3` with Lines on read (1), (1), (2), (3) in English; the Hebrew was right. | `formatDataForPesukim` keeps a separate verse counter per language. | **Fixed.** `format-data-for-pesukim.test.js`. Step 3.2. |
| K2 | **A slow linker scan read as "nothing found".** Polling gave up after about 5 s and returned an empty result; so did a network error. | Polls for about 30 s, then says Sefaria was still scanning; network errors say Sefaria couldn't be reached. | **Fixed.** `sefaria-unavailable.test.js`. Step 7.9. |
| K3 | **Linker offsets went stale if the document changed before Apply.** | Each match records which occurrence of its text it is; Apply re-finds it, and reports citations that are gone. | **Fixed.** `linker-classify.test.js`. Step 7.7. |
| K4 | **Insert from a table** (linker per-row Insert, and the cursor in general). The cursor path in fact put the source at an unrelated place in the body, silently, for texts, sheets and lexicon alike. | One resolver for every insert path (`server/insertion-target.gs`): paragraph layouts go inside the cell; Right–Left / Left–Right go below the table with a notice; headers, footers and footnotes are refused with a message. | **Fixed.** `insertion-target.test.js`. Steps 2.5–2.8, 7.4, 8.4. |
| K5 | **Network failure read as "no match".** | `findReference` throws "Couldn't reach Sefaria…" for no response, 5xx and 429; an unknown reference is still "no match". | **Fixed.** `sefaria-unavailable.test.js`. Step 11.1. |
| K6 | Original-add-on users' stored preferences. | — | **Not applicable**: the published add-on stores no preferences. |
| K7 | Legacy `nekudot_filter="tanach"`. | — | **Not applicable**, as K6. |
| K8 | **"Vowels only in Tanakh" had no control**, and toggling Vowels reset it. | A **Vowels only in Tanakh** switch in Preferences → Insertion; turning Vowels on keeps it. | **Fixed.** `vowels-tanakh-only.test.js`. Step 5.9. |

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
| 1.1 | **B:** install from a Doc; open **Extensions** without reloading. | Menu present; Release Notes dialog opened. | No menu until reload (the regression pinned in `triggers.test.js`). |
| 1.2 | **B:** open a second Doc in a new tab *before* doing anything in the first. | Menu builds in the second Doc too. | Menu missing or partial. In `AuthMode.NONE` the menu is built from the default layout without reading preferences. That is expected; a missing menu is not. |
| 1.3 | **B:** open Preferences straight away. | Every field shows a value. Colours read **Auto / None**. Divine Name Mappings: יהוה → יי on, others off. | Blank fields, black swatches, or `undefined` anywhere (seeding missed a key). |
| 1.4 | **A:** open a Doc. Open Preferences. | Everything you set before the upgrade is unchanged. | Anything reset to a default. Compare against a screenshot taken before the upgrade. |
| 1.5 | Open the sidebar in two Docs at once, same account. Change Layout in one. | The other sidebar is unaffected (session state is per sidebar). | Settings bleeding between sidebars. |

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
| 3.1 | `Genesis 1:1-5`, Lines on, both languages | Verses numbered 1–5 and א–ה. | Numbers off by one. |
| 3.2 | `Genesis 1:31-2:3`, Lines on, both languages | English (31), (1), (2), (3); Hebrew לא, א, ב, ג. | **K1 (fixed):** English reading (1), (1), (2), (3). There is still no chapter marker at the break; decide if that's acceptable. |
| 3.3 | `Genesis 1:31-2:3`, Lines **off** | Verses joined as prose with single spaces; nothing lost at the chapter break. | Words run together at the boundary (`...good.The heaven...`). |
| 3.4 | `Berakhot 2a:5-2b:2` | Spans the amud break; readable. | Missing segments or a doubled segment at the break. |
| 3.5 | `Psalms 119` (176 verses), both, Lines on | Inserts in well under 30 s. | Timeout, or a sidebar stuck on the spinner. Time it. |
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
| 4.2 | Same, with **🔗 Title** on | Each title opens *that* translation on sefaria.org. | Every link opening the default translation. |
| 4.3 | Add a translation that doesn't cover the verse (a partial translation) to the multi-select | Skipped, reported, and greyed out *unavailable for this ref*. | An empty block, or a duplicate of the default translation. |
| 4.4 | Multi-select, then switch Layout to **Right–Left** | Blocked, or reduced to one translation with a message. | Several translations crammed into one table cell, or silently dropped. |
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
| 5.7 | Turn **Source Emphasis** off; insert the same | Flat text. | Leftover bold. |
| 5.8 | Vowels off, Cantillation on | Cantillation kept, vowels gone, sof pasuq **׃** and paseq **׀** kept. | Punctuation stripped with the vowels. |
| 5.9 | Preferences → Insertion → turn on **Vowels only in Tanakh**; save. Insert `Mishnah Berakhot 1:1` and `Genesis 1:1`. Then turn Vowels off and on again in Preferences, save, and reopen | Mishnah without niqqud, Genesis with. After the off/on, the switch is still on. | **K8 (fixed):** the switch reset by the Vowels toggle. |
| 5.10 | **Translit** on; cycle every scheme; insert `Genesis 1:1` each time | Transliteration present and different per scheme; font follows the Transliteration role. | Transliteration in the Hebrew font; an empty line. |
| 5.11 | Insert a text with `&thinsp;` in the Hebrew (Talmud or Mishnah with thin spaces) | No literal `&thinsp;`, `&nbsp;` or `&…;`. | Any literal entity. |
| 5.12 | **💾 Save as defaults** in the Layout tray while Preferences is open in a dialog; then **Save Defaults** in the dialog | The last save wins. Decide whether that's acceptable, and whether the dialog should warn. | Silent revert of the sidebar save. |

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
| 7.3 | Review the table | Paragraphs 2, 3 (both), 6, 7, 10 (both items) found. Avodah Zarah is a dropdown with excerpts, Link unchecked. Fakebook counted as unresolved. Psalms 23 (linked to example.com) **not** offered. | The paragraph 8 split-format citation, the footnote (12) and the header (13) are expected **misses** because the scan reads the body text only. Record whether any appear, and whether the report mentions them. |
| 7.4 | Tick **Insert** on the table citation (Isaiah 40:1) and on one list item; apply. Repeat with the default layout set to Hebrew only | Right–Left default: the Isaiah source goes below the table and the done message says why. Hebrew only: it goes inside the cell, under the citation. The list item's source goes below the list item. Your cursor doesn't move. | **K4 (fixed):** the source at the end of the document, or no explanation. |
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
| 10.1 | Leave the sidebar open over 6 hours (the session cache TTL); then change Layout and insert | Works, perhaps with defaults restored. | A script error, or a silent insert with the wrong layout. |
| 10.2 | Incognito window (browser storage blocked or empty) | Sidebar works; Session Library and search history empty but not broken. | Console errors from `localStorage`. |
| 10.3 | Preferences → Menu Bar: hide every item you're allowed to; reload | Preferences and Help & Support still present, last. | An empty menu with no way back. |
| 10.4 | Menu Bar: nest items three levels; reload | Flattened or rejected clearly (Docs supports one submenu level). | A broken menu. |
| 10.5 | **Reset To Defaults** | Everything back to defaults, including יהוה → יי on. | Anything left over; `linker_upload_acknowledged` reset (it should **not** be reset). |
| 10.6 | Preferences → Experimental: enable, turn on Surprise Me, run it with every corpus off | "Choose at least one corpus." | Script error. |
| 10.7 | **🔁 Refresh** in Preferences | Sidebar reopens from saved defaults. | Silent no-op (the historical regression). |

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
| 12.1 | Use only the keyboard: <kbd>/</kbd>, type, <kbd>↓</kbd>, <kbd>Enter</kbd>, <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, <kbd>Esc</kbd> | A full search-and-insert without the mouse. | A focus trap in the Layout tray or the Hebrew keyboard. |
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
| 13.4 | Turn on **Vowels only in Tanakh**; insert it again | No niqqud, as before. | The switch doing nothing. |
| 13.5 | Bilingual insert with defaults | A two-column table, Hebrew on the right: the published add-on's layout. | A different default layout. |

---

## Reporting

For each failure, record:

1. Step number (e.g. **7.4**) and account (**A / B / C**)
2. What happened versus **Expect**
3. Browser console output and the Executions entry (duration, error)
4. Scan mode and After-linking mode, for anything in section 7
5. Version: **2.1.0, schema 13**, and the commit you pushed

Anything under **Known suspects** that reproduces should get a row in
[`docs/regression-log.md`](../regression-log.md) and a pinning test when it's
fixed. K1–K5 and K8 already have rows and tests.

| Date | Tester | Account | Commit | Sections run | Failures |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
