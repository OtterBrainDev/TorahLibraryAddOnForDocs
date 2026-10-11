# First-Run Setup and Simple Mode: Design

> **Status:** Draft for review. No code yet.
> **Target release:** 2.2.0 (MINOR: new preference keys, handled by a migration)
> **Preference schema:** 19 → 20

---

## 1. Summary

New users answer a few questions the first time they use the add-on. The answers
do two different things, and the design keeps them apart:

1. **Content defaults:** how an inserted source looks. Hebrew and/or translation,
   layout, vowels, divine-name practice, translation language. Every user needs
   these, beginner or expert.
2. **Interface mode:** how much of the add-on you see. **Simple** or **Full**.
   It controls the menu, the sidebar's secondary controls, and which Preferences
   tabs are shown.

There is no "Beginner / Intermediate / Pro / Custom" tier stored anywhere. The
setup writes ordinary preference values once. After that, the user's settings
are just their settings. "Custom" is what you have the moment you change one.

### Goals

- A rabbi or teacher who is not comfortable with software can insert a correctly
  formatted source within a minute of installing, without seeing the linker,
  corpus ordering, emphasis mapping or per-language typography.
- The divine-name choice, a halachic and communal decision, is asked explicitly
  instead of being buried in a settings tab.
- Nobody who already uses the add-on loses a feature, a menu item or a control
  they did not choose to give up (CLAUDE.md hard rules 1 and 2).

### Non-goals

- No feature gating, licensing or paid tiers.
- No change to what Full mode looks like: Full mode is exactly today's add-on.
- No change to insertion output for anyone who clicks through setup without
  changing an answer.

---

## 2. Why two modes, not four tiers

- **Expertise in the texts and comfort with software are different skills.**
  The core audience includes rabbis who are expert in the texts and uneasy with
  software. "Beginner" insults them; "Pro" scares them off features they'd use.
  So setup asks *what you will do*, not *how good you are*.
- **"Intermediate" has no stable definition.** Each boundary between tiers
  becomes a support question ("where did X go?").
- **Every UI variant multiplies the test surface.** The entry templates have
  byte-for-byte snapshots and selector contracts. Two modes doubles them; four
  would quadruple them.

---

## 3. Who sees setup, and when

`onInstall` is **not** a reliable trigger. It only fires when a user installs
from inside a document. Installs from the Marketplace website, and installs an
admin pushes to a whole organization, never run it. So setup is driven by a
stored flag, checked on first use.

| User | How we can tell | Setup shown? | Interface mode |
| --- | --- | --- | --- |
| New, installed from inside a document | `onInstall` fires; no schema stored | Yes, straight after install (replaces the Release Notes dialog) | Chosen in setup |
| New, installed from the Marketplace website or by an admin | No schema stored at first open | Yes, the first time they open the sidebar | Chosen in setup |
| Upgrader from the current add-on (schema 1–19) | Schema stored | **No** | Full, set by migration |
| Legacy user of the original published add-on | No schema stored (that add-on stored no preferences), so indistinguishable from a new user | Yes; screen 1 offers "I've used Torah Library before: keep everything" | Chosen in setup; dismissing keeps Full |

The last row is why **the code default for the interface mode is Full, not
Simple.** Legacy users look exactly like new ones, so nobody can be put into
Simple mode without choosing it. (Hard rule 2: a default that turns off what an
existing user had is the regression this project has already paid for.)

### Trigger points

- **`onInstall`**: after seeding preferences and building the menu, open the
  setup dialog instead of Release Notes when setup is pending. Today
  `releaseNotesPopup` has no other entry point (no menu item, no Help link), so
  this change adds a "What's new" link to the Help dialog to keep it reachable.
- **Sidebar open** (`openSharedSidebar_`): if setup is pending, show the sidebar
  and then the setup dialog over it. Dialogs and sidebars can be open together.
- **Insert Source from Selection** and the other quick actions **never** wait on
  setup. Someone who highlights a citation and runs the menu item gets the
  insert, with today's defaults.
- **Dismissing** the dialog (close button or Escape) marks setup done, keeps
  Full mode, and changes nothing else. It never reappears by itself.
- **Help → "Run setup again"** reopens it at any time, preselected with the
  user's current values.

---

## 4. The setup screens

The dialog is a new modal entry template, about 640 × 600. Three short screens
and a done screen. A progress indicator ("1 of 3") and a **Back** button on
every screen.

**Principle: every screen's preselected answer is the user's current value.**
For a new user that is the code default. Clicking **Continue** through every
screen without touching anything changes no content preference. Only the
interface-mode choice on screen 3 writes something new.

### Screen 1: "What will you mostly use Torah Library for?"

One choice, large cards with an icon and one line each:

| Card | Line under it |
| --- | --- |
| **Quoting sources in my writing** | Divrei Torah, sermons, newsletters, emails |
| **Preparing source sheets** | Classes, shiurim, study partners |
| **Academic writing** | Papers, articles, books with citations |
| **I've used Torah Library before** | Keep everything as it is |

The last card skips to the done screen with Full mode and no changes.

The other answers only change which answers are **preselected** on screens 2
and 3 (see §5). They write nothing on their own.

### Screen 2: "How should sources look?"

A live preview of **Deuteronomy 6:4** sits at the top and updates as the user
answers. The verse has both יהוה and אלהינו, so the divine-name answers are
visible in the preview. The sample text is bundled in the template: the
preview needs no network request and no RPC.

1. **Show:** Hebrew and translation · Hebrew only · Translation only
   → `output_mode_default` (`both` / `he` / `en`)
2. **Arrangement** (only when "Hebrew and translation" is chosen):
   Side by side, Hebrew on the right · Hebrew above the translation
   → `bilingual_layout_default` (`he-right` / `he-top`). `he-left` stays
   available in Preferences; it is not offered here.
3. **Vowels:** Always · Only in Tanakh · Never
   → `nekudot` + `nekudot_filter` (`always` / `tanakh` / `never`)
4. **Cantillation marks (trope):** On · Off → `teamim`
5. **God's name:** each row with an on/off switch and the substitute,
   exactly as in Preferences:
   - יהוה → `meforash_replace`, `meforash_replacement` (default on, יי)
   - אלהים → `elodim_replace`, `elodim_replacement` (default off, אלוקים)
   - יה → `yaw_replace`, `yaw_replacement` (default off, קה)
   - God (in translations) → `god_replace`, `god_replacement` (default off, G-d)

   One line of help text: "Many communities avoid writing God's name in full on
   paper that may be thrown away. Choose what your community does."
6. **Translation language:** a short dropdown of the languages Sefaria
   translates into, English first → `preferred_translation_language`.

### Screen 3: "How much do you want to see?"

Two cards, each with a small screenshot of the sidebar in that mode:

- **Simple:** "Search, preview, insert. Everything else is one click away."
- **Everything:** "Every tool and setting, including Link Texts, Voices and
  Lexicon."

→ `ui_mode` (`simple` / `full`). Preselected from screen 1 (§5).

### Done screen

"You're set." Then three lines:

- "Open the sidebar from Extensions → Torah Library → Texts."
- "Highlight a reference like *Genesis 1:1* and choose **Insert Source from
  Selection**."
- "Change any of this in Preferences. Run setup again from Help."

And one button: **Start** (closes the dialog and focuses the sidebar's search).

---

## 5. What each answer preselects

Screen 1 changes only the preselected answers on screens 2 and 3. The user sees
and can change every one of them before anything is saved.

| Screen 1 answer | Screen 2 preselection | Screen 3 preselection |
| --- | --- | --- |
| Quoting sources in my writing | Current defaults, except **Arrangement: Hebrew above** (`he-top`), which pastes more cleanly into prose and email | Simple |
| Preparing source sheets | Current defaults (side by side, Hebrew on the right) | Simple |
| Academic writing | Current defaults | Everything |
| I've used Torah Library before | (screens skipped) | Full, no changes |

> **Decision needed:** whether the "quoting" preset should move to `he-top`. It
> is the only place a preset differs from today's defaults. Dropping that
> difference makes screen 1 affect only the interface mode. See §12.

A deliberate omission: the presets do **not** touch `insert_citation_default`,
`link_texts_default`, `source_title_heading`, fonts, colours or emphasis.
Those stay at the code defaults until the user changes them in Preferences.
That keeps the preset table short enough to reason about and test.

---

## 6. What Simple mode changes

Simple mode **collapses**; it never removes. Every hidden control can be reached
in at most two clicks, through a "More options" disclosure or "Show advanced
settings". The **Interface** switch in Preferences (§7) turns Simple mode off at
any time.

### Menu

Simple mode writes a `menu_layout`:

```json
{
  "top": ["texts", "insert_from_selection", "quick_actions"],
  "quick_actions": ["transform_divine_names", "link_texts"],
  "hidden": ["voices", "lexicon", "quick_actions_sidebar", "unlink_sources",
             "gematriya_count", "surprise_me"]
}
```

Preferences and Help are appended by the menu builder as always. Because the
items are `hidden`, not removed, turning them back on in the Menu Bar tab puts
each one back in its usual place.

**Switching modes and a customized menu:**

- Switching **to** Simple saves the user's existing `menu_layout` (if any) in
  `menu_layout_before_simple` and writes the Simple layout.
- Switching **back** to Full restores that saved layout. If none was saved,
  `menu_layout` is deleted, which falls back to the code default (an unset
  layout tracks new menu items; see `migrateToV10_`).
- If the user edits the menu while in Simple mode, their edit wins. Switching to
  Full then asks: "Keep your current menu, or restore the full menu?"

**Known limitation:** in a document where the add-on has not been used yet,
`onOpen` runs in `AuthMode.NONE` and cannot read preferences. Apps Script shows
the default (full) menu there until the user uses the add-on in that document.
The customizable menu already has this limitation; Simple mode inherits it.

### Sidebar

| Element | Simple | Full |
| --- | --- | --- |
| Search box, Hebrew keyboard, recent sources, results, source card | Shown | Shown |
| **Insert** button | Shown | Shown |
| Translation language filter (`#translation-language-dropdown`) | Shown | Shown |
| Texts / Voices / Lexicon tab bar | Hidden; sidebar opens in Texts | Shown |
| Sort (`#search-sort-mode`), Restore corpus menu | Hidden | Shown |
| **Layout** button and tray | Under "More options" | Shown |
| Footer: Session Library, Quick Actions panel | Under "More options" | Shown |
| Footer: Preferences, Help, Feedback | Shown | Shown |
| Experimental (🧪) | Hidden | As today (off unless enabled) |

"More options" is one disclosure button above the footer. Opening it shows the
hidden controls in their usual form; it does not remember its state between
sessions. If a search is run from Voices or Lexicon through a menu item a Simple
user re-enabled, the sidebar opens in that mode and shows the tab bar.

Implementation: a `data-ui-mode="simple"` attribute on the sidebar root, with CSS
in the sidebar's own stylesheet. **Hidden by CSS only**, never removed from the
DOM, so selector contracts, RPC wiring and event bindings are unchanged in both
modes.

### Preferences dialog

| Tab | Simple | Full |
| --- | --- | --- |
| Fonts | Shown | Shown |
| Insertion | Shown | Shown |
| Search | Behind "Show advanced settings" | Shown |
| Linking | Behind "Show advanced settings" | Shown |
| Menu Bar | Shown | Shown |
| Experimental | Behind "Show advanced settings" | As today |

Inside the Fonts tab, the per-language translation typography and the
emphasis-mapping sections collapse behind the same switch.

"Show advanced settings" is a switch at the bottom of the tab bar. It reveals the
tabs for this dialog session only; it does not change `ui_mode`.

---

## 7. Data model

### New preference keys

| Key | Values | Code default | In `SETTINGS` (client-writable)? |
| --- | --- | --- | --- |
| `ui_mode` | `simple` / `full` | `full` | Yes. Set from the Interface switch in Preferences |
| `first_run_setup` | `pending` / `done` | `pending` | **No.** Written only by the setup RPCs and the migration |
| `menu_layout_before_simple` | JSON layout or empty | `""` | **No.** Written only when the mode switches |

Why `first_run_setup` defaults to `pending` and still upgrades safely:
`seedDefaultPreferences_` writes it only for users with **no** schema stored
(new users and legacy published-add-on users). Upgraders already have a schema,
and the v20 migration marks them `done` before they ever see the flag.

Keeping `first_run_setup` out of `SETTINGS` means "Reset to defaults" in
Preferences cannot send an existing user back through setup, and the
`setPreferences` filter (pinned by `set-preferences.test.js`) keeps the client
from writing it. No current test requires every default to appear in
`SETTINGS`; the new keys add a test asserting that `ui_mode` is in it and the
other two are not.

### Migration v20

```js
/**
 * V20: introduces `ui_mode`, `first_run_setup` and `menu_layout_before_simple`.
 * Everyone with a schema already uses the add-on: they get Full mode (exactly
 * what they have now) and are never shown first-run setup. A stored value is
 * never overwritten. Users with no schema were seeded by
 * seedDefaultPreferences_ before this runs, so they keep `pending`.
 */
function migrateToV20_(userProperties) {
  if (userProperties.getProperty('ui_mode') == null) {
    userProperties.setProperty('ui_mode', 'full');
  }
  if (userProperties.getProperty('first_run_setup') == null) {
    userProperties.setProperty('first_run_setup', 'done');
  }
  if (userProperties.getProperty('menu_layout_before_simple') == null) {
    userProperties.setProperty('menu_layout_before_simple', '');
  }
  return true;
}
```

The ordering matters and must be pinned by a test: for a no-schema user, the
driver seeds defaults (`first_run_setup = pending`) **before** running
migrations, so v20's `done` never overwrites it.

`menu_layout_before_simple` is excluded from seeding the same way `menu_layout`
is: it should only ever hold a layout the user actually had.

### The one commit that ships the keys

Per `docs/versioning.md` §2, in a single commit:

- defaults in `getDefaultPreferences()`;
- `migrateToV20_` and its call in `runUserPreferenceMigrationsIfNeeded_`;
- `PREFS_SCHEMA_CURRENT_ = '20'`;
- `prefsSchemaVersion: 20` in `docs/VERSION.json`;
- version 2.2.0 everywhere `VERSION.json` lists a surface;
- a CHANGELOG entry that says, first sentence: existing users keep the full
  interface, and new users choose Simple or Full during setup.

---

## 8. Server side

A new file, `apps-script/server/first-run.gs`. The preset logic is a pure
function, so Node tests can load the file on its own, like `menu-layout.gs`.

| Function | Reachable from `google.script.run`? | Arity | Purpose |
| --- | --- | --- | --- |
| `openFirstRunSetup` | Yes (Help → "Run setup again") | 0 | Shows the setup dialog |
| `getFirstRunSetupData` | Yes | 0 | The user's current values for every key setup can write, to preselect answers |
| `completeFirstRunSetup` | Yes | 1 | Takes the answers as JSON, writes them, sets `first_run_setup = done`, rebuilds the menu |
| `dismissFirstRunSetup` | Yes | 0 | Sets `first_run_setup = done`; writes nothing else |
| `setUiMode` | Yes (Preferences Interface switch) | 1 | Switches mode, handles the menu save and restore in §6, rebuilds the menu |
| `planFirstRunPreferences_` | No (pure) | 1 | Answers → `{key: value}` to write. Drops unknown keys and invalid values |
| `isFirstRunSetupPending_` | No | 0 | Read by `onInstall` and `openSharedSidebar_` |

Every new public function goes into `docs/rpc-surface.json` in the same commit
(hard rule 8).

`completeFirstRunSetup` validates against an allowlist: only the keys listed in
§4 can be written, and each value must be one the matching Preferences control
can produce. Anything else is dropped, never stored. Logging follows hard rule
7: log `error.message` only, never the answers.

`getSidebarBootstrapData` gains one field, `uiMode`, so the sidebar can set
`data-ui-mode` before its first paint. The Preferences bootstrap gets the same
field.

---

## 9. Client side

- **New entry template** `apps-script/first-run-setup.html`. It includes
  `shared/ui/head` and `shared/css/native-controls`, carries the shared
  Content-Security-Policy, and takes colours and spacing from
  `apps-script/css/tokens.html`, with no inline token copies.
- **Preview:** the Deuteronomy 6:4 sample (Hebrew with vowels and trope,
  English) is embedded in the template. The preview applies the vowel, trope and
  divine-name choices client side. It must apply them the same way
  `text-processing.gs` does, so a test feeds the same input through both and
  compares (§10).
- **No `.innerHTML`:** the preview is built with `textContent` and
  `createElement`. If that turns out to be impractical, each assignment needs
  the justification comment of hard rule 5.
- **Accessibility:** each screen is a `fieldset` with a `legend`. Answer cards
  are native radio inputs styled as cards. Focus moves to the screen heading on
  Continue and Back. Escape dismisses (§3). The preview is `aria-hidden`, since
  the answers already describe it.

---

## 10. Tests

New tests in `test/tests/`:

- `first-run-setup.test.js`
  - `planFirstRunPreferences_` maps each answer to the keys in §4 and drops
    unknown keys and invalid values.
  - Clicking through with the preselected answers writes no content key whose
    value differs from what is stored.
  - "I've used Torah Library before" writes only `first_run_setup = done` and
    `ui_mode = full`.
  - Dismissing writes only `first_run_setup = done`.
  - The preview's client-side vowel, trope and divine-name rules give the same
    text as `text-processing.gs` for the Deuteronomy 6:4 sample.
- `migrations.test.js` additions
  - Schema 19 → 20: `ui_mode = full`, `first_run_setup = done`; existing values
    are kept.
  - No schema: seeding runs first, so `first_run_setup` ends `pending` and
    `ui_mode` ends `full`.
- `menu-layout.test.js` additions
  - The Simple layout normalizes cleanly and keeps Preferences and Help last.
  - Simple → Full restores a saved custom layout; with none saved, it falls back
    to the code default.
- `triggers.test.js` additions
  - `onInstall` opens setup, not Release Notes, when setup is pending; it opens
    Release Notes when setup is done (a reinstall).

New and updated UI tests in `test/ui/`:

- Template snapshots for `first-run-setup.html`, and for the sidebar and
  Preferences in Simple mode.
- `rpc-surface.json` entries for the new public functions.
- Selector contracts for the setup screens' answer inputs.
- `csp-coverage`, `native-controls` and `include-wiring` cover the new entry
  template automatically once it exists; confirm they do.

`docs/regression-log.md` gets a row only if one of these pins a bug that has
already happened. The upgrade rule in §3 is the divine-name regression's
pattern, so its migration test cites that row.

---

## 11. Marketing alignment

- **Marketplace listing:** the first screenshot shows the Simple flow:
  highlight *Genesis 1:1*, choose Insert Source from Selection, and the
  formatted source appears. Advanced features (Link Texts, side-by-side tables,
  Voices) come in later screenshots.
- **Copy by audience, not by tier:** the listing description and any landing
  page speak to the screen 1 audiences in their own words: day-school teachers,
  shul rabbis writing divrei Torah, students, academics. What the listing
  promises then matches the first thing each user sees.
- **Graduating users:** after a Simple-mode user's 25th insert, one tip in the
  sidebar: "Did you know Torah Library can link every citation in a document to
  Sefaria?" with **Show me** (opens Link Texts) and **Don't show tips**. Shown
  once. Counting inserts across sessions needs a stored counter, which means
  another preference key, migration and schema bump. So the tip is out of scope
  for 2.2.0 and listed in §12.

`docs/marketplace-listing.md` and the store screenshots are updated in the
release that ships this, not before.

---

## 12. Open questions

1. **The `he-top` preset for the "quoting" answer** (§5). It is the only place a
   preset differs from today's defaults. Keep it, or let screen 1 affect only
   the interface mode?
2. **Default for a new user who dismisses setup.** This design keeps Full,
   because a legacy user of the original add-on cannot be told apart from a new
   one. The cost: a new, unsure user who closes the dialog gets the full
   interface. An alternative is to make dismissing ask once ("Use the simple
   interface?"). Recommendation: ship with Full and measure through feedback
   before adding a step.
3. **Voices and Lexicon in Simple mode.** Hidden here, on the reasoning that
   they are the least-used for quoting. If source-sheet preparers rely on Voices,
   that answer could keep its tab visible.
4. **The graduation tip's counter** (§11): ship in 2.2.0 with a new key, or
   defer to a later release?

---

## 13. Delivery plan

Each step is a separate commit that leaves `npm test` and `pre_clasp_qc.sh`
green.

1. **Keys and migration:** the single commit described in §7, with its tests. No UI
   reads the keys yet, so behaviour is unchanged for everyone.
2. **Server:** `first-run.gs`, the RPC surface entries, and the `onInstall` and
   sidebar triggers, behind `first_run_setup` (only new users are affected).
3. **Setup dialog:** the entry template, preview and tests.
4. **Simple mode:** sidebar and Preferences CSS, the Interface switch, menu
   save and restore, snapshots.
5. **Release:** CHANGELOG, `docs/live-test-checklist-2.2.0.md` (fresh install
   from inside a document, from the Marketplace website, an upgrade from 2.1.0,
   and a no-schema legacy user), listing and screenshots.
