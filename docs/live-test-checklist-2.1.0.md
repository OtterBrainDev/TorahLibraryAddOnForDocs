# Live test checklist — v2.1.0

Run this in a real Google Doc after `clasp push`, before the Marketplace
submission. Everything here is something the automated suite **cannot** reach:
119 tests cover pure logic, contracts and snapshots, but nothing in CI opens a
sidebar, holds a `DocumentApp` handle, or makes a request to Sefaria.

**Version under test:** 2.1.0 · **preference schema:** 9
Confirm both before starting — *Help & Support → About* should read
**Current line: 2.1**. If it says 2.0, the push did not land.

Two accounts' worth of setup matters, because half the risk in this release is
in the *upgrade* path:

- **Account A — upgrading user.** Already had the add-on installed before this
  push. Do **not** reset preferences. This is the account that proves the
  migrations work.
- **Account B — fresh install.** Or Account A with preferences reset. Proves
  `onInstall` seeds correctly.

---

## 0. Smoke — does it load at all

| # | Check | Expected |
| --- | --- | --- |
| 0.1 | Open a Doc, open the add-on menu | Menu builds; **Texts / Voices / Lexicon / Insert Source from Selection / Quick Actions / Preferences / Help** all present |
| 0.2 | Open the sidebar | Renders fully — not a blank or half-styled panel |
| 0.3 | Type a query and press search | Results appear |

> **0.2 and 0.3 are the jQuery 3.7.1 canary.** jQuery moved from 1.9.1 (2013),
> and it is loaded with Subresource Integrity — if the hash is wrong the script
> does not load *at all* and every interactive element is dead. A blank sidebar
> or a search box that does nothing means jQuery, not your query. Check the
> browser console for an integrity error before debugging anything else.

---

## 1. Content Security Policy

The CSP is new and restricts image loading. It is the other thing that fails
silently.

| # | Check | Expected |
| --- | --- | --- |
| 1.1 | Sidebar footer | The Sefaria logo renders |
| 1.2 | Trigger a loading state (search) | The spinner GIF renders, not a broken-image icon |
| 1.3 | Voices tab → select a sheet | The "open on Sefaria" arrow icon renders |

Any missing image here means the `img-src` list in
`apps-script/shared/ui/head.html` is short a host. The browser console names it.

---

## 2. Upgrade path — Account A only

The most consequential and least reversible part of this release.

| # | Check | Expected |
| --- | --- | --- |
| 2.1 | Open Preferences → Fonts | Your previous fonts, sizes and styles are intact |
| 2.2 | Preferences → Fonts → **Source Emphasis** | Toggle is **on** |
| 2.3 | Fonts → colour and highlight fields | All show **Auto / None** (muted), *not* black |
| 2.4 | Preferences → **Privacy & Document Scanning** | Document scanning = **Candidate passages only**; After linking = **Show a summary…** |
| 2.5 | Divine Name Mappings | Your previous replacement settings are unchanged |

> **2.3 is the one to look hardest at.** Colour defaults to *unset*. If any field
> shows a solid black swatch instead of the muted Auto state, the v8 migration
> wrote `#000000` somewhere and every insertion from now on will force black
> text — including in dark or themed documents.

---

## 3. Insertion and source emphasis

| # | Check | Expected |
| --- | --- | --- |
| 3.1 | Insert **Steinsaltz Talmud**, e.g. `Berakhot 2a`, English | The Talmud's own words arrive **bold**, Steinsaltz's explanation plain |
| 3.2 | Insert a footnoted text (Rashi, or any Tanakh with notes) | Footnote markers survive; no raw `<sup>` or `<i>` in the document |
| 3.3 | Preferences → set Translation style to *italic*, re-insert 3.1 | Body italic **and** the source's bold still visible on top |
| 3.4 | Set a translation **text colour**, insert | Colour applies to the body; source bold still bold |
| 3.5 | Set a **highlight**, insert, then set it back to *None* and insert again | Highlight applies, then stops applying |
| 3.6 | Source Emphasis → **Advanced**: map bold → blue text, no bold. Insert 3.1 | The Talmud's words are blue and not bold |
| 3.7 | Insert a **title** with a hyperlink | Title styling follows your *hyperlink* preference, not the source's emphasis |

> 3.3 is the layering claim: your style is the baseline, the source's emphasis
> sits on top. 3.7 is its boundary — titles deliberately do *not* preserve
> source emphasis.

---

## 4. Search

| # | Check | Expected |
| --- | --- | --- |
| 4.1 | `A Woman's Commentary` | Results, or a **"related entries"** panel offering *The Torah: A Women's Commentary* — **not** a blank panel |
| 4.2 | `Jacob's Ladder`, `don't` | Not mangled; no zero-result dead end from the apostrophe |
| 4.3 | `Psalms 23` | Resolves. **Not** "Pesalms" |
| 4.4 | `Hil. Shabbat 1:1` | Resolves to *Mishneh Torah, Hilchot Shabbat 1:1* |
| 4.5 | `Hil. Avodah Zarah 12:11` | Suggests *Mishneh Torah, Hilchot Avodah Kochavim* **first**; the Talmud tractate also offered, lower |
| 4.6 | `רמב״ם` (with gershayim) | Resolves or suggests — **not** silently nothing |
| 4.7 | `בראשית א׳:א׳` | Resolves |
| 4.8 | `qqqq zzzz` | An explicit "no results" message naming what to try — not a blank panel |
| 4.9 | A footnoted text's **preview** in the sidebar | Bold/italic/footnotes render; no visible tags |

> 4.1–4.7 are the five normalization bugs found in this cycle. Each one failed
> *silently* before — the query returned nothing and looked like a gap in
> Sefaria's library. If any returns an empty panel with no message, that is the
> bug class recurring.

---

## 5. Link Texts with Sefaria

Build one test document containing, in this order:

1. A clean citation — `Genesis 1:1`
2. An ambiguous one — `Avodah Zarah 2a` (Talmud vs. its commentaries)
3. A nonsense one — `Fakebook 99:99`
4. A citation on a line **~200 characters away** from any other, surrounded by
   plain prose with no citations
5. Two paragraphs of ordinary prose containing no citation at all

| # | Check | Expected |
| --- | --- | --- |
| 5.1 | Run it for the **first time** | A one-time confirmation naming which scan mode is active, and asking to continue |
| 5.2 | Decline it | Nothing is uploaded, nothing changes in the document |
| 5.3 | Run again, accept | Dialog opens **immediately** with a scanning state — not a frozen menu |
| 5.4 | When the scan finishes | Summary line: how many will link automatically, how many need a choice, how many could not be resolved |
| 5.5 | The ambiguous row | Checkbox **unchecked**, a dropdown of candidates, each showing a Hebrew title and an excerpt |
| 5.6 | Pick a candidate from the dropdown | The row checks itself |
| 5.7 | Apply | Progress advances; links land on the right words |
| 5.8 | Check the linked text | `Genesis 1:1` links to Genesis; your chosen candidate links where you chose |
| 5.9 | Item 3 (`Fakebook 99:99`) | Counted as unresolved in the summary — **not** silently absent |
| 5.10 | Run the whole thing again | Already-linked references are **not** re-offered or double-linked |
| 5.11 | Preferences → After linking → **Show every match**, re-run on a fresh copy | All matches listed, unambiguous ones pre-checked |
| 5.12 | Preferences → After linking → **Just link and report a count**, re-run | No dialog; an alert with counts including what was skipped |

> **5.9 is the point of the whole feature.** The published add-on reported
> "Linked N references" and nothing else. If a failure is still invisible here,
> the release has not delivered its main claim.
>
> **5.4** may also report *"fell across a gap in the partial scan"* — that is the
> unplaceable count, and item 4 in the test document is what provokes it. Its
> remedy is switching to **Whole document**, which 5.13 checks.

| # | Check | Expected |
| --- | --- | --- |
| 5.13 | Preferences → Document scanning → **Whole document**, re-run on a fresh copy | Any previously-unplaceable citation now links |

---

## 6. Privacy surfaces

| # | Check | Expected |
| --- | --- | --- |
| 6.1 | Preferences → Privacy & Document Scanning → policy link | Opens the privacy policy |
| 6.2 | Help & Support → About → **Privacy policy** pill | Same |
| 6.3 | Preferences shows both scanning controls | *Document scanning* and *After linking* |

---

## 7. Everything else still works

Quick regression sweep — these were not the focus, so they are the ones a
refactor breaks quietly.

| # | Check | Expected |
| --- | --- | --- |
| 7.1 | **Voices** tab: search, select, insert a source sheet | Inserts; media links present and pointing at real URLs |
| 7.2 | **Lexicon** tab: look up a Hebrew word, and an English one | Both return entries; insertion works |
| 7.3 | Quick Actions → **Transform Divine Names** | Applies your enabled replacements |
| 7.4 | Quick Actions → **Unlink Sources** | Removes Sefaria links, leaves other links alone |
| 7.5 | Quick Actions → **Gematriya Count** | Opens with a value |
| 7.6 | **Insert Source from Selection** — select `Genesis 1:1`, run | Inserts; selection preserved |
| 7.7 | Preferences → **Reset Preferences** | Returns to defaults; colours go back to Auto |
| 7.8 | Preferences → **Refresh Sidebar** | Sidebar reopens |
| 7.9 | Multi-select translations, insert | All selected translations inserted, in the order chosen |

---

## Reporting back

For anything that fails, the useful report is:

1. The check number
2. What you saw versus what the table says
3. **Browser console output** — most of the new failure modes (SRI, CSP,
   `google.script.run`) show there and nowhere else
4. Which account (A upgrading / B fresh) and the scan mode in effect

State the version too: **2.1.0, schema 9**. "It broke" is not checkable
later; the version and the check number are.
