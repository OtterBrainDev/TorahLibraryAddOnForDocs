# Voices Tab Redesign Specification

> **Branch:** `claude/redesign-voices-tab-ui-hRTnB`
> **Status:** Draft — ready for engineering handoff
> **Scope:** UX/product specification and front-end implementation guidance only. No backend changes required.

---

## 1. Executive Summary

The Voices tab in the Torah Library sidebar is currently structured as a **settings-first panel**: the user encounters two segmented control rows (insert mode, transliteration) before seeing any content preview. This is the wrong order. It forces the user to configure output before they have enough information to decide whether the selected sheet is even the one they want.

The redesign inverts this priority. The **selected content card becomes the leading element** — the first thing visible after a sheet is chosen. Insert options and transliteration settings move below the card as secondary, calmer controls. Actions (Insert, Open on Sefaria) remain in the existing footer, which already works well, but are made self-evident through the layout so that no explanatory text is needed.

This brings Voices in line with the **content-first, browse/inspect/act** pattern used by the Texts tab, which users already understand. The result is a workflow that feels natural:

1. **Select** a sheet from search results
2. **Inspect** the preview card — title, author, excerpt, topics
3. **Adjust** output options if needed (secondary, below the card)
4. **Act** — Insert or Open

Three additional problems are fixed as part of this redesign:
- The 4-button transliteration segmented control, which cannot fit all four labels at sidebar width without truncation, is replaced by a `<select>` dropdown — the same pattern already used by the Lexicon tab.
- Insert mode labels are sharpened: "Reference" → "Citation", "Contents" → "Text", "Both" → "Citation + text".
- The antipattern copy "Use the Open button below to view on Sefaria." is removed; the actions are self-evident.

---

## 2. UX Problems in the Current Design

### 2.1 Settings-first ordering

The `voices-insert-options` section — containing both segmented controls — is rendered above the preview (`.suggestions`). A user selecting a sheet encounters configuration UI before content. The correct question at selection time is *"Is this the right piece?"*, not *"How should I format the output?"*

### 2.2 Transliteration control truncates

The 4-button segmented control for transliteration uses `flex: 1 1 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis` across four buttons in `apps-script/css/layout.html:1058–1073`. At sidebar width (~248px usable after padding), four flex-equal buttons each get ~58px. At `font-size: 12px; font-weight: 700`, "Traditional" requires ~72px and is forced to truncate to "Trad." — a label that is ambiguous to users who don't already know the scheme names. "Simplified" similarly cannot display in full.

### 2.3 "Both" is too vague

The label "Both" communicates nothing without prior context. Users reading the segmented control for the first time cannot determine what "Both" refers to unless they already know the other two options mean citation and text content.

### 2.4 Explanatory copy masking a broken affordance

The text "Use the Open button below to view on Sefaria." inside `buildVoicesPreviewHtml()` is a red flag: it tells users where a button is rather than letting the button's placement speak for itself. It is also positionally misleading — it appears inside the preview area, but the button is in the footer below an unrelated section boundary.

### 2.5 Unnecessary accordion wrapper

The `<details>` accordion around the insert controls adds a tap/click to reach them and visually groups them as "advanced options" they are not. For a two-field control panel, the accordion creates more friction than it prevents.

### 2.6 Preview is visually secondary

The `.suggestions` div holding the preview card is rendered after the accordion in document order, and visually below it. The content the user cares most about is at the bottom of the panel, below controls they may not need.

### 2.7 No insertion summary in the preview area

The current preview includes a `"Will insert: Reference + contents"` line but it is rendered inside the preview HTML by `buildVoicesPreviewHtml()` rather than as a persistent, live-updating UI element. When the user changes the insert mode, the entire preview div is re-rendered by jQuery `.html()`. This flicker is unnecessary and should be replaced with a stable summary element that updates in place.

### 2.8 Mixed layout responsibilities

The `buildVoicesPreviewHtml()` function in `search-controller.html` is responsible for both content display (title, author, excerpt, topics) and state summary ("Will insert: …" and "Use the Open button below…"). These are different concerns and should be separated: the content card should be stable; the status/summary line should be a separate, independently updated element.

---

## 3. Product/UX Specification

### 3.1 Purpose

The Voices tab lets users discover Sefaria source sheets (curated collections of Jewish texts with commentary, called "Voices"), preview them in context, and insert a citation or the full sheet contents into their Google Document with optional transliteration.

### 3.2 Primary user needs

1. **Find** a relevant source sheet by searching keywords, topics, or author.
2. **Evaluate** whether the selected sheet is the right piece — without opening a browser tab.
3. **Configure** what gets inserted (citation, full text, or both) and how Hebrew is rendered.
4. **Insert** the content or open the sheet on Sefaria for deeper review.

### 3.3 Key use cases

| # | Use case | Success condition |
|---|----------|-------------------|
| 1 | Search and select a sheet | User sees title, author, excerpt, and topics in the card immediately after clicking a result |
| 2 | Evaluate relevance | User can read enough of the preview to decide without leaving the sidebar |
| 3 | Insert citation only | User selects "Citation", clicks Insert — a formatted citation appears in the document |
| 4 | Insert full text | User selects "Text", clicks Insert — the full sheet content appears with loading indicator |
| 5 | Insert citation + text | User selects "Citation + text" — both are inserted together |
| 6 | Apply transliteration | User selects a transliteration scheme — the preference is applied at insert time |
| 7 | Open on Sefaria | User clicks "Open Sheet" in the footer — the sheet opens in a browser tab |
| 8 | No match found | User sees a clear, helpful empty state with guidance |

### 3.4 Information architecture

The panel has three layers of information, ordered by decision urgency:

```
Layer 1 (Primary)   — CONTENT CARD
                       What is this? Is it relevant?
                       title · author · excerpt · topics

Layer 2 (Secondary) — INSERT OPTIONS
                       How should this be inserted?
                       insert mode (citation / text / both)
                       transliteration scheme

Layer 3 (Status)    — INSERTION SUMMARY
                       Confirmation of the current choice
                       "Will insert: Citation only"

Layer 4 (Actions)   — FOOTER (existing)
                       Insert into document · Open on Sefaria
```

Layer 1 is always visible when a sheet is selected. Layers 2–3 are compact and below the card. Layer 4 is the existing footer, unchanged in position.

### 3.5 Interaction model

The redesigned Voices tab follows this flow:

1. User types in the search input (placeholder: "Search source sheets…")
2. Results appear in the result list below the input
3. User clicks a result — the selected state is applied to that item
4. **Content card** appears (or updates) immediately below the result list
5. User reads the card; if the excerpt is long, they can expand it
6. User optionally changes insert mode or transliteration in the compact options section
7. The insertion summary line updates in place (no card re-render)
8. User clicks "Add Sheet" in the footer to insert, or "Open Sheet" to view on Sefaria

Changing the insert mode does **not** re-render the entire preview card. Only the insertion summary line updates.

### 3.6 Layout model

```
┌──────────────────────────────────────────┐
│ [Tab bar: Texts | Voices | Lexicon]      │
│ ┌────────────────────────────────────┐   │
│ │  Search source sheets…             │   │  ← .input
│ └────────────────────────────────────┘   │
│                                          │
│  [Result list]                           │  ← .result-list (voice results)
│                                          │
│ ┌────────────────────────────────────┐   │
│ │  CONTENT CARD (.voice-preview-card)│   │  ← new primary block
│ │  Title                  [↗ Open]  │   │
│ │  By Author                         │   │
│ │  ─────────────────────────────    │   │
│ │  Excerpt text… [See more ▾]        │   │
│ │  ─────────────────────────────    │   │
│ │  · Topic  · Topic  · Topic         │   │
│ └────────────────────────────────────┘   │
│                                          │
│  What to insert                          │  ← .compact-section-label
│  [Citation] [Text] [Citation + text]     │  ← .insert-mode-selector
│                                          │
│  Transliteration                         │  ← .compact-section-label
│  [None (no transliteration)          ▾]  │  ← <select>
│                                          │
│  Will insert: Citation only              │  ← .voices-insertion-summary
│                                          │
├──────────────────────────────────────────┤
│ [Open Sheet]         [Add Sheet    →]    │  ← footer (unchanged)
└──────────────────────────────────────────┘
```

### 3.7 Sidebar-specific constraints

- Usable width: approximately 248px (sidebar width ~272px minus 12px padding each side per `--sidebar-padding: 12px`).
- No horizontal scrolling. All controls must fit within the usable width.
- The 4-button transliteration segmented control at 12px bold font cannot display full labels within this width. The `<select>` dropdown uses the full width and natively handles any label length.
- The 3-button insert mode control ("Citation", "Text", "Citation + text") must be verified: at 248px with 4px gap and 4px padding, each button gets approximately 76px. At 12px bold, "Citation + text" requires about 80px and may be tight. If it truncates, the label should fall back to "Both texts" or the button group padding/gap should be reduced to 3px.
- Font sizes below 11px are not acceptable for accessibility. 12px is the minimum used in the current design.
- Touch targets must be at least 30px tall (existing `min-height: 30px` on `.insert-mode-btn` satisfies this).
- Hebrew text requires `dir="rtl"` or `dir="auto"` to render correctly. Mixed Hebrew/English content (common in sheet excerpts) requires `dir="auto"` at the paragraph level.

### 3.8 Empty state (no item selected)

When the user is on the Voices tab but has not selected a sheet, the content card section is hidden (matching the current behavior of `voices-insert-options` visibility — controlled by `updateModeDependentSections()` in `mode-controller.html:159`).

Display guidance text in the search/results area:
> "Search for a source sheet above to get started."

This is already handled by the existing `results-hint` mechanism. No new empty state UI element is needed.

### 3.9 Loading states

**Search loading:** Existing `.preview-loading` spinner for results — no change needed.

**Content card loading:** When a sheet is selected, if any async fetch is needed to populate the card, show a skeleton placeholder inside the card container:
- Two skeleton lines for title area (1 wide, 1 medium)
- Three skeleton lines for excerpt
- One skeleton line for topics

Use the existing `.skeleton-line` or equivalent CSS pattern from the codebase if available.

**Insert loading:** When "Text" or "Citation + text" is selected and Insert is clicked, the existing `.voices-fetch-loading` element is shown. This behavior is unchanged.

### 3.10 Error and fallback states

| Scenario | Behavior |
|----------|----------|
| Search fails | Existing failure handler in `runVoicesQuery()` displays `"Voices search is temporarily unavailable."` via `.results-hint` — no change |
| Selected item has no excerpt | Show only title and author; omit excerpt block; show topics if available |
| Selected item has no topics | Omit topics row entirely |
| Insert fails | Existing `showInsertWarning()` mechanism — no change |
| Transliteration not applicable | No special UI at selection time; backend error handled by `showInsertWarning()` |

### 3.11 Accessibility requirements

- Content card: `role="region"` with `aria-label="Selected sheet preview"`.
- Insert mode segmented control: retains existing `role="radiogroup"` / `role="radio"` semantics. Labels must not be abbreviated.
- Transliteration `<select>`: associated `<label>` or `aria-labelledby` pointing to the section label above it.
- Insertion summary (`.voices-insertion-summary`): `aria-live="polite"` so screen readers announce mode changes.
- Excerpt toggle: `aria-expanded` toggled by JS; button text changes between "See more" and "See less".
- Inline "Open" button inside card: `aria-label="Open [sheet title] on Sefaria"`.
- Color contrast: all text meets WCAG AA minimum 4.5:1 for normal text.

### 3.12 Content and labeling recommendations

#### Insert mode labels

| Current | Recommended | Rationale |
|---------|-------------|-----------|
| Reference | Citation | More natural for document context; "reference" is ambiguous with biblical references |
| Contents | Text | Direct — describes what gets inserted |
| Both | Citation + text | Explicit compound — no guessing required |

#### Transliteration labels (in `<select>`)

| Current (button) | Recommended (option) | Notes |
|-----------------|----------------------|-------|
| Off | None | Idiomatic for a dropdown "off" state |
| Simple | Simplified | Full word, now readable in dropdown |
| Trad. | Traditional | Full word, now readable |
| Israeli | Modern Israeli | More precise; distinguishes from "traditional Israeli" |

#### Section labels

| Current | Recommended |
|---------|-------------|
| "Insert Options" (accordion header) | Remove the accordion; use inline compact labels only |
| "What to insert" | Keep — clear and direct |
| "Transliteration" | Keep |

### 3.13 Recommended microcopy

| Location | Copy |
|----------|------|
| Search placeholder | "Search source sheets…" (existing, keep) |
| Card title fallback | "Untitled sheet" |
| Card author fallback | Omit author line entirely if no owner |
| Excerpt toggle | "See more ▾" / "See less ▴" |
| Insertion summary | "Will insert: Citation only" / "Will insert: Full text" / "Will insert: Citation + text" |
| Fetch loading | "Fetching sheet contents…" (existing, keep) |
| No results | "No source sheets matched this search." (existing, keep) |
| Empty tab | "Search for a source sheet above to get started." (existing via results-hint) |

**Remove entirely:** `"Use the Open button below to view on Sefaria."` — the footer button is already labeled "Open Sheet".

### 3.14 Success criteria

1. When a sheet is selected, the content card is the first element visible below the result list.
2. The card shows title, author (if available), excerpt (if available), and topics (if available).
3. No label in any control is truncated at the default sidebar width.
4. The transliteration control renders all four option labels in full.
5. Changing the insert mode does not cause the content card to re-render or flash.
6. The insertion summary line updates immediately when insert mode changes.
7. The text "Use the Open button below" does not appear anywhere in the UI.
8. The insert options section has no accordion — options are visible immediately.
9. All controls meet WCAG AA contrast and have correct ARIA roles.
10. The tab feels consistent with the Texts tab's browse/inspect/act pattern.

---

## 4. Detailed Wireframe Description

### 4.1 Overall sidebar structure

The sidebar is a single scrollable column. When no sheet is selected, the panel shows: tab bar → search input → result list → empty hint. When a sheet is selected, the panel shows: tab bar → search input → result list (collapsed or scrollable) → **content card** → insert options → footer.

The footer is fixed at the bottom of the sidebar and does not scroll.

### 4.2 Tab bar

Unchanged from current implementation. Three mode-switch buttons (Texts | Voices | Lexicon), the active tab highlighted with `--sefaria-blue` background and white text. No changes needed.

### 4.3 Search input row

Unchanged. Single text input with placeholder "Search source sheets…". Submit button on right. History button if applicable.

### 4.4 Result list

Unchanged. When results exist, the `.result-list` renders sheet items. The selected item has the existing `.is-selected` visual state (highlighted background).

If no search has been run: empty. If search returned no results: `results-hint` shows "No source sheets matched this search."

### 4.5 Content card — `.voice-preview-card`

This is the redesigned version of what is currently rendered by `buildVoicesPreviewHtml()` into `.suggestions`.

**Container:**
- Background: `var(--card)` (#f3f1ed)
- Border: `1px solid var(--border)` (#d9d8d3)
- Border-radius: 12px
- Padding: 12px
- Margin: 0 0 10px 0
- No box-shadow (keeps it subtle; matches card treatment elsewhere in the sidebar)

**Header row (title + Open button):**
- Two-column layout: `display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start`
- Left: Title (`.voice-preview-title`)
  - Font: EB Garamond or Roboto bold, 14px, color `var(--text)` (#222)
  - Line-height: 1.3
  - No ellipsis — allow wrapping to 2 lines max
- Right: Inline "Open ↗" button (`.voice-preview-open-btn`)
  - Small ghost button: `font-size: 11px; padding: 3px 6px; border: 1px solid var(--border); border-radius: 6px; color: var(--sefaria-blue); background: transparent`
  - Label: "Open ↗" with `aria-label="Open [title] on Sefaria"`
  - On hover: background `var(--selected-soft)` (#ddeeff)
  - This duplicates the footer "Open Sheet" button for convenience; clicking either opens the same URL

**Byline row (`.voice-preview-byline`):**
- Display: `block`
- Font: Roboto regular, 12px, color `var(--muted)` (#666)
- Content: "By [owner name]"
- Margin-top: 2px
- Omitted entirely if `item.owner` is falsy

**Divider:** `border-top: 1px solid var(--border); margin: 8px 0`

**Excerpt (`.voice-preview-excerpt`):**
- Font: Roboto regular, 13px, color `var(--text)`, line-height 1.5
- `dir="auto"` to handle mixed Hebrew/English
- Clamped to 4 lines by default: `overflow: hidden; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical`
- When expanded: `overflow: visible; -webkit-line-clamp: unset`
- Omitted entirely if `item.snippet` and `item.summary` are both falsy

**Excerpt toggle (`.voice-preview-excerpt-toggle`):**
- Appears only if the excerpt text exceeds 4 lines (requires a JS height check after render)
- Inline text-button: `font-size: 11px; color: var(--sefaria-blue); background: none; border: none; padding: 0; cursor: pointer; margin-top: 4px`
- Label: "See more ▾" (collapsed) / "See less ▴" (expanded)
- `aria-expanded="false"` (collapsed default), toggled by click handler
- Toggles `.voice-preview-card--expanded` class on the card (or a data attribute) to unconstrain the excerpt

**Divider:** `border-top: 1px solid var(--border); margin: 8px 0`

**Topics row (`.voice-preview-topics`):**
- Displayed only if `item.topics` is a non-empty array
- Layout: `display: flex; flex-wrap: wrap; gap: 4px; margin-top: 0`
- Each topic is a chip (`.voice-preview-tag`):
  - `font-size: 11px; padding: 2px 7px; border-radius: 20px; background: rgba(24,52,93,0.08); color: #18345d; border: 1px solid rgba(24,52,93,0.15)`
  - Max 5 topics shown (matching current `item.topics.slice(0, 5)` in `buildVoicesPreviewHtml()`)
  - No ellipsis on individual chips — if a topic name is very long, it wraps inside its chip

### 4.6 Insert options section — `.voices-options-section`

Replaces the `<details>` accordion in `voices-insert-options`. No accordion needed.

**Container:**
- No border, no background — flows inline in the sidebar
- Margin-bottom: 10px

**"What to insert" label:**
- `.compact-section-label` (existing class): `font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: #4d596d; margin-bottom: 4px`

**Insert mode segmented control:**
- Identical structure to current `.insert-mode-selector` / `.insert-mode-btn`
- Three buttons: `data-value="reference"` → "Citation" | `data-value="contents"` → "Text" | `data-value="both"` → "Citation + text"
- If "Citation + text" truncates at sidebar width, reduce gap to 2px and padding to `4px 6px`
- Active state: `background: #18345d; color: #fff`

**"Transliteration" label:**
- Same `.compact-section-label` styling; margin-top: 8px, margin-bottom: 4px

**Transliteration `<select>` (id: `voices-translit-select`):**
- Reuse `.translation-version-select` CSS (existing class used by Lexicon tab's `#lexicon-insert-mode`):
  - `width: 100%; font-size: 12px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: #fff; color: var(--text); cursor: pointer`
- Options:
  ```html
  <option value="none">None</option>
  <option value="simple_english">Simplified</option>
  <option value="traditional">Traditional</option>
  <option value="modern_israeli">Modern Israeli</option>
  ```
- Default selection: `value="none"` (matches current "Off" default)
- `aria-labelledby="voices-translit-label"` where `voices-translit-label` is the id on the compact section label above

### 4.7 Insertion summary — `.voices-insertion-summary`

A single line below the transliteration control.

- Font: Roboto regular, 11px, color `var(--muted)` (#666)
- Content updates when insert mode changes: "Will insert: Citation only" / "Will insert: Full text" / "Will insert: Citation + text"
- `aria-live="polite"` so screen readers announce changes
- Margin-top: 6px

### 4.8 Fetch loading indicator

The existing `.voices-fetch-loading` element stays inside the `voices-insert-options` section (below the options). It is shown/hidden by the existing logic in `footer-actions.html`. No changes needed to its position or behavior.

### 4.9 Footer row

Unchanged. The existing footer with "Open Sheet" (secondary) and "Add Sheet" (primary) buttons. The "Open Sheet" button opens `selectedVoiceItem.url` in a new tab. The "Add Sheet" button triggers the insert flow.

No explanatory text needed in the footer or anywhere else. The button labels are self-documenting.

### 4.10 Spacing and density

| Area | Current | Recommended |
|------|---------|-------------|
| Between card and insert options | 0px (accordion immediately follows preview) | 10px margin |
| Between insert option rows | 6px gap (existing) | 6px — keep |
| Card internal padding | n/a (no card container currently) | 12px |
| Card border-radius | n/a | 12px |
| Topics chips gap | n/a | 4px |

### 4.11 Typography hierarchy

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Sheet title | Roboto or EB Garamond | 14px | 700 | #222 |
| Author byline | Roboto | 12px | 400 | #666 |
| Excerpt | Roboto | 13px | 400 | #222, `dir=auto` |
| Topic chip label | Roboto | 11px | 400 | #18345d |
| Section label | Roboto | 11px | 700 | #4d596d |
| Button labels (segmented) | Roboto | 12px | 700 | #506077 / #fff (active) |
| Select option text | Roboto | 12px | 400 | #222 |
| Insertion summary | Roboto | 11px | 400 | #666 |

### 4.12 Hover / focus / selected states

- **Insert mode button (inactive hover):** background `#f0f0ee`, color `#18345d`
- **Insert mode button (active):** background `#18345d`, color `#fff`, inset shadow
- **Insert mode button (focus-visible):** `outline: 2px solid var(--selected); outline-offset: 2px` (existing)
- **Transliteration `<select>` focus:** browser native focus ring (acceptable); optionally `outline: 2px solid var(--selected)`
- **Topic chip hover:** background `rgba(24,52,93,0.14)` — subtle darker tint
- **"Open ↗" button hover:** background `var(--selected-soft)` (#ddeeff), no border change
- **"See more" toggle hover:** text-decoration underline

### 4.13 Loading state (card skeleton)

While sheet data loads (if applicable), show inside `.voice-preview-card`:

```
┌────────────────────────────────────────┐
│ ████████████████████████         [   ] │  ← title skeleton + open btn placeholder
│ ████████████                           │  ← byline skeleton
│ ─────────────────────────────────────  │
│ ███████████████████████████████████    │  ← excerpt skeleton line 1
│ █████████████████████████████          │  ← excerpt skeleton line 2
│ ██████████████████████                 │  ← excerpt skeleton line 3
│ ─────────────────────────────────────  │
│ ███████   █████████   ███████          │  ← topic chip skeletons
└────────────────────────────────────────┘
```

Skeleton lines use `background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite` — or the existing skeleton pattern if one exists in the codebase.

### 4.14 Empty / default state (no sheet selected)

The `.voice-preview-card`, `voices-options-section`, and `.voices-insertion-summary` are all hidden via `display: none`. Visibility is toggled by `updateModeDependentSections()` in `mode-controller.html` based on `!!selectedVoiceItem`.

---

## 5. Recommended Interaction Flows

### 5.1 Arriving on the Voices tab

1. User clicks the "Voices" mode-switch button.
2. `setSidebarMode('voices')` runs in `mode-controller.html`.
3. `body` gets class `mode-voices`; placeholder changes to "Search source sheets…"; insert button label changes to "Add Sheet"; open button label changes to "Open Sheet".
4. If no previous search: input is empty, result list is empty, content card is hidden, footer buttons are disabled.
5. If returning to Voices tab with a previously selected item: card and options are visible, showing the last selected sheet.

### 5.2 Searching for a sheet

1. User types in the search input.
2. On submit (Enter or search button click), `runVoicesQuery()` fires.
3. Loading spinner appears in results area.
4. Results render in the result list. Each item shows sheet title and author.
5. If no results: `results-hint` shows "No source sheets matched this search."

### 5.3 Selecting a sheet

1. User clicks a result item.
2. The item gets `.is-selected` styling (existing).
3. `selectedVoiceItem` is set to the result object.
4. `updateModeDependentSections()` shows `.preview-section` and the new `voices-options-section`.
5. The content card renders with title, author, excerpt (clamped), and topic chips.
6. If the excerpt height exceeds 4 lines, the "See more ▾" toggle appears below it.
7. The insertion summary reads "Will insert: Citation only" (default mode).
8. Footer "Add Sheet" and "Open Sheet" buttons become enabled.

### 5.4 Reviewing the preview / expanding the excerpt

1. User reads the visible 4-line excerpt.
2. If more content exists, user clicks "See more ▾".
3. The excerpt clamp is removed; the card expands to show the full excerpt.
4. Toggle label changes to "See less ▴"; `aria-expanded` becomes `"true"`.
5. User clicks "See less ▴" to re-clamp.

Implementation note: the height-check to determine if the toggle should appear must run after the card renders. Use a `setTimeout(fn, 0)` after injecting the card HTML, or use a `ResizeObserver` if available. Check `element.scrollHeight > element.offsetHeight` on the excerpt container.

### 5.5 Changing the insert mode

1. User clicks a different insert mode button ("Text" or "Citation + text").
2. The click handler in `search-controller.html:390` fires.
3. Active class is moved to the clicked button; `aria-checked` is updated.
4. **The content card is not re-rendered** — only the insertion summary text is updated:
   ```js
   var modeLabels = { reference: 'Citation only', contents: 'Full text', both: 'Citation + text' };
   $('.voices-insertion-summary').text('Will insert: ' + modeLabels[insertMode]);
   ```
5. The `aria-live="polite"` region announces the update to screen readers.

This is a behavioral change from the current implementation, which calls `$('.suggestions').html(buildVoicesPreviewHtml(...))` on every mode button click — causing the entire card to re-render and the excerpt toggle state to reset.

### 5.6 Changing the transliteration scheme

1. User changes the `<select>` value.
2. The `change` event handler updates `selectedTransliterationScheme` (or reads directly from the select at insert time — the simplest approach).
3. No visible UI update is needed beyond the select's own selected option display.
4. The scheme is read from `$('#voices-translit-select').val()` in the insert handler (replacing the current `.voices-translit-btn[aria-checked="true"]` selector).

### 5.7 Inserting into the document

1. User clicks "Add Sheet" in the footer.
2. The insert handler in `footer-actions.html` reads:
   - `insertMode` from `.insert-mode-btn[aria-checked="true"]:not(.voices-translit-btn)` data value (unchanged — the segmented control still uses the same mechanism)
   - `transliterationScheme` from `$('#voices-translit-select').val()` (changed from button selector)
3. If `insertMode` is `"contents"` or `"both"`: `.voices-fetch-loading` is shown.
4. `google.script.run.insertSheet(sheetPayload, { insertMode, transliterationScheme })` is called.
5. On success: loading hides, session library updates, footer shows success state (existing behavior).
6. On failure: `showInsertWarning()` displays the error message (existing behavior).

### 5.8 Opening on Sefaria

Two paths:
- **Footer button ("Open Sheet"):** Existing `#open-on-sefaria` behavior — opens `selectedVoiceItem.url` in a new tab. No change.
- **Inline card button ("Open ↗"):** New button added to the card header. Same behavior — opens `selectedVoiceItem.url`. Use `window.open(selectedVoiceItem.url, '_blank')` or an `<a target="_blank">` element. The footer button remains the primary action; the card button is a convenience shortcut.

### 5.9 Preview content unavailable

If `item.snippet` and `item.summary` are both empty or absent:
- Render the card without the divider and excerpt block.
- The card shows: title, author (if available), topics (if available).
- No placeholder text like "No preview available" — the absence of an excerpt is self-explanatory.
- The insert options and actions are still available; the user can still insert by citation.

### 5.10 Transliteration not available or not applicable

- No UI change at selection time. The transliteration setting only affects insertion, not preview.
- If the backend cannot transliterate the selected content, `showInsertWarning()` surfaces the error after the insert attempt.
- The `<select>` remains at whatever value the user selected. No automatic reset.

---

## 6. Suggested UI Labels and Microcopy

### 6.1 Insert mode buttons

| data-value | Current label | New label | Rationale |
|------------|--------------|-----------|-----------|
| `reference` | Reference | **Citation** | Avoids confusion with biblical references; natural for document context |
| `contents` | Contents | **Text** | Direct — one word that describes what gets inserted |
| `both` | Both | **Citation + text** | Explicit compound; self-describing without prior context |

### 6.2 Transliteration select options

| value | Current label | New label |
|-------|--------------|-----------|
| `none` | Off | **None** |
| `simple_english` | Simple / Sim… | **Simplified** |
| `traditional` | Trad. | **Traditional** |
| `modern_israeli` | Israeli | **Modern Israeli** |

### 6.3 Section and field labels

| Element | Copy |
|---------|------|
| Insert mode group label | **What to insert** (keep) |
| Transliteration label | **Transliteration** (keep) |
| Card region label (aria) | **Selected sheet preview** |
| Inline Open button | **Open ↗** |
| Insertion summary prefix | **Will insert:** |

### 6.4 Insertion summary values

| Mode | Summary line |
|------|-------------|
| Citation | Will insert: Citation only |
| Text | Will insert: Full text |
| Citation + text | Will insert: Citation + text |

### 6.5 State copy

| State | Location | Copy |
|-------|----------|------|
| Empty (no search) | results-hint | Search for a source sheet above to get started. |
| No results | results-hint | No source sheets matched this search. (keep) |
| Search error | results-hint | Voices search is temporarily unavailable. (keep) |
| Insert loading | voices-fetch-loading | Fetching sheet contents… (keep) |
| Card title missing | voice-preview-title | Untitled sheet |
| Excerpt collapsed | toggle button | See more ▾ |
| Excerpt expanded | toggle button | See less ▴ |

### 6.6 Tooltips

| Element | Tooltip |
|---------|---------|
| Inline Open ↗ button | Open this sheet on Sefaria |
| Citation button | Insert a formatted citation: title, link, and summary |
| Text button | Insert the full sheet text content |
| Citation + text button | Insert both a citation and the full text |
| Transliteration select | Choose how Hebrew text is romanized when inserted |

### 6.7 Remove entirely

- `"Use the Open button below to view on Sefaria."` — remove from `buildVoicesPreviewHtml()`. The footer "Open Sheet" button is self-explanatory.

---

## 7. Front-End Implementation Guidance

### 7.1 File-by-file changes

#### `apps-script/sidebar.html` (lines 146–175)

Replace the entire `<section class="voices-insert-options">` block. Remove the `<details>` accordion wrapper. Replace the 4-button transliteration group with a `<select>`. Update insert mode button labels.

```html
<section class="voices-insert-options voices-options-section" style="display:none;" aria-label="Voices insert options">
  <div class="voices-insert-controls">
    <div class="compact-section-label" id="voices-insert-mode-label">What to insert</div>
    <div class="insert-mode-selector" role="radiogroup" aria-labelledby="voices-insert-mode-label">
      <button type="button" class="insert-mode-btn is-active" data-value="reference" role="radio" aria-checked="true">Citation</button>
      <button type="button" class="insert-mode-btn" data-value="contents" role="radio" aria-checked="false">Text</button>
      <button type="button" class="insert-mode-btn" data-value="both" role="radio" aria-checked="false">Citation + text</button>
    </div>
    <div class="compact-section-label" id="voices-translit-label" style="margin-top:8px;">Transliteration</div>
    <select id="voices-translit-select" class="translation-version-select" aria-labelledby="voices-translit-label">
      <option value="none">None</option>
      <option value="simple_english">Simplified</option>
      <option value="traditional">Traditional</option>
      <option value="modern_israeli">Modern Israeli</option>
    </select>
    <div class="voices-insertion-summary" aria-live="polite">Will insert: Citation only</div>
  </div>
  <div class="voices-fetch-loading preview-loading" style="display:none;" aria-live="polite" aria-label="Fetching sheet contents">
    <span class="preview-loading-spinner" aria-hidden="true"></span>
    <span>Fetching sheet contents…</span>
  </div>
</section>
```

#### `apps-script/sidebar/js/search-controller.html` — `buildVoicesPreviewHtml()`

Rewrite to produce card markup only (no summary line, no "Use the Open button" text). The summary line is now a persistent element in the HTML, updated separately.

```js
function buildVoicesPreviewHtml(item) {
  if (!item) return '';
  var title   = escapeHTML(item.label || item.ref || 'Untitled sheet');
  var owner   = item.owner ? escapeHTML('By ' + item.owner) : '';
  var snippet = escapeHTML(normalizeOptionText(item.snippet || item.summary || ''));
  var topics  = Array.isArray(item.topics) && item.topics.length
    ? item.topics.slice(0, 5).map(function(t) {
        return "<span class='voice-preview-tag'>" + escapeHTML(t) + "</span>";
      }).join('')
    : '';
  var openBtn = item.url
    ? "<a class='voice-preview-open-btn' href='" + escapeHTML(item.url) + "' target='_blank' rel='noopener' aria-label='Open " + title + " on Sefaria'>Open ↗</a>"
    : '';
  var html = "<div class='voice-preview voice-preview-card' role='region' aria-label='Selected sheet preview'>";
  html += "<div class='voice-preview-header'><div class='voice-preview-title'>" + title + "</div>" + openBtn + "</div>";
  if (owner) html += "<div class='voice-preview-byline preview-meta'>" + owner + "</div>";
  if (snippet) {
    html += "<hr class='voice-preview-divider'>";
    html += "<div class='voice-preview-excerpt' dir='auto'>" + snippet + "</div>";
    html += "<button type='button' class='voice-preview-excerpt-toggle' aria-expanded='false' style='display:none;'>See more ▾</button>";
  }
  if (topics) {
    html += "<hr class='voice-preview-divider'>";
    html += "<div class='voice-preview-topics'>" + topics + "</div>";
  }
  html += "</div>";
  return html;
}
```

After injecting, schedule the height check:
```js
$('.suggestions').html(buildVoicesPreviewHtml(selectedVoiceItem));
setTimeout(function() {
  var $ex = $('.voice-preview-excerpt');
  if ($ex.length && $ex[0].scrollHeight > $ex[0].offsetHeight) {
    $('.voice-preview-excerpt-toggle').show();
  }
}, 0);
```

#### `apps-script/sidebar/js/search-controller.html` — event handlers

Insert mode click handler: stop re-rendering the card. Update only the summary line.
```js
$(document).on('click', '.insert-mode-btn:not(.voices-translit-btn)', function () {
  if (appMode !== 'voices') return;
  var $group = $(this).closest('[role="radiogroup"]');
  $group.find('.insert-mode-btn').removeClass('is-active').attr('aria-checked', 'false');
  $(this).addClass('is-active').attr('aria-checked', 'true');
  var mode = $(this).data('value') || 'reference';
  var labels = { reference: 'Citation only', contents: 'Full text', both: 'Citation + text' };
  $('.voices-insertion-summary').text('Will insert: ' + (labels[mode] || 'Citation only'));
});
```

Excerpt toggle handler (new):
```js
$(document).on('click', '.voice-preview-excerpt-toggle', function () {
  var $btn = $(this);
  var expanded = $btn.attr('aria-expanded') === 'true';
  $btn.attr('aria-expanded', !expanded);
  $btn.text(expanded ? 'See more ▾' : 'See less ▴');
  $btn.prev('.voice-preview-excerpt').toggleClass('voice-preview-excerpt--expanded', !expanded);
});
```

#### `apps-script/sidebar/js/footer-actions.html` (line 52)

Change transliteration reader from button selector to select:
```js
// Before:
var transliterationScheme = $('.voices-translit-btn[aria-checked="true"]').data('value') || 'none';
// After:
var transliterationScheme = $('#voices-translit-select').val() || 'none';
```

### 7.2 Semantic HTML notes

- The card uses `role="region"` + `aria-label` rather than `<article>` to stay consistent with the `role="region"` pattern used by other sidebar sections.
- The excerpt toggle is a `<button type="button">`, not a `<details>` element, so JS controls the expand/collapse and `aria-expanded` stays in sync.
- The `<a>` for the inline Open button uses `target="_blank" rel="noopener"` for security.
- The `<select>` for transliteration is natively keyboard-accessible (arrow keys, Home/End). No custom keyboard handling needed.
- The insert mode `role="radiogroup"` retains existing keyboard behavior (Tab to group, arrow keys within).

### 7.3 CSS additions — `apps-script/css/layout.html`

Add these rules in the `INSERT MODE SELECTOR` section (after line 1087):

```css
/* Voice preview card */
.voice-preview-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 10px;
}

.voice-preview-header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: start;
}

.voice-preview-open-btn {
  flex-shrink: 0;
  font-size: 11px;
  padding: 3px 7px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--sefaria-blue);
  background: transparent;
  text-decoration: none;
  white-space: nowrap;
}
.voice-preview-open-btn:hover { background: var(--selected-soft); }

.voice-preview-byline { margin-top: 2px; }

.voice-preview-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 8px 0;
}

/* Excerpt clamp + expand */
.voice-preview-excerpt {
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}
.voice-preview-excerpt--expanded {
  overflow: visible;
  -webkit-line-clamp: unset;
  display: block;
}

.voice-preview-excerpt-toggle {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--sefaria-blue);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.voice-preview-excerpt-toggle:hover { text-decoration: underline; }

/* Topic chips */
.voice-preview-topics { display: flex; flex-wrap: wrap; gap: 4px; }
.voice-preview-tag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 20px;
  background: rgba(24, 52, 93, 0.08);
  color: var(--sefaria-blue);
  border: 1px solid rgba(24, 52, 93, 0.15);
}

/* Insertion summary */
.voices-insertion-summary {
  margin-top: 6px;
  font-size: 11px;
  color: var(--muted);
}

/* Voices options section (replaces accordion) */
.voices-options-section { margin-bottom: 10px; }
```

The `#voices-translit-select` inherits all styles from the existing `.translation-version-select` class (already defined in the codebase for the Lexicon tab's `#lexicon-insert-mode`). No new select styles are needed.

### 7.4 RTL and Hebrew text handling

- Set `dir="auto"` on `.voice-preview-excerpt` so the browser detects the dominant script and applies RTL or LTR directionality per paragraph.
- The `.voice-preview-title` can also use `dir="auto"` since some sheet titles are in Hebrew.
- Topic chip text is typically English and does not require special direction handling.
- If the excerpt contains Hebrew block quotes (common in source sheets), `dir="auto"` on the container is sufficient — the browser will render each paragraph in the appropriate direction.
- Frank Ruhl Libre is already loaded in `tokens.html` for Hebrew display. No additional font import needed.

### 7.5 Avoiding truncation in segmented controls

The 3-button insert mode control ("Citation", "Text", "Citation + text") must be tested at actual sidebar width. If "Citation + text" wraps or clips:

- Option A: Reduce `.insert-mode-selector` padding from `4px` to `3px` and gap from `4px` to `2px` — gains ~6px total.
- Option B: Rename to "Both" with a tooltip explaining the meaning (less preferred — "Both" is vague).
- Option C: Break the three options into a `<select>` (same pattern as transliteration) — acceptable if A doesn't work.

Test at 248px usable width before finalizing.

### 7.6 Primary and secondary action placement

The footer already handles Insert (primary) and Open (secondary). The inline "Open ↗" button in the card header is a **convenience duplicate** for users who want to verify before inserting, not a replacement for the footer button. Both should remain.

Do not add a second Insert button inside the card — the footer Insert button is the single authoritative action entry point, which keeps the insertion flow predictable.

### 7.7 Consistency with the Texts tab

| Pattern | Texts tab | Voices (redesigned) |
|---------|-----------|---------------------|
| Content-first preview | Yes — preview section leads | Yes — card leads |
| Accordion for options | No — options are inline | No — removed |
| Segmented controls | Yes (output mode, layout) | Yes (insert mode only) |
| Select for complex options | Yes (translation version) | Yes (transliteration) |
| Insertion summary | Yes (preview text) | Yes (`.voices-insertion-summary`) |
| Footer actions | Insert + Open | Insert + Open (unchanged) |

---

## 8. Acceptance Criteria

### Layout and hierarchy
- [ ] When a sheet is selected, the content card (`.voice-preview-card`) is the first element visible below the result list — above the insert options section.
- [ ] The insert options section has no `<details>` accordion wrapper; options are visible immediately without any toggle.
- [ ] The footer "Add Sheet" and "Open Sheet" buttons are unchanged in position and behavior.

### Content card
- [ ] The card displays: title, author byline (if `item.owner` is set), excerpt (if `item.snippet` or `item.summary` is set), topic chips (if `item.topics` is non-empty).
- [ ] If the excerpt is longer than 4 lines, a "See more ▾" toggle appears; clicking it expands the excerpt. Clicking "See less ▴" re-collapses it.
- [ ] The card includes an inline "Open ↗" link that opens `item.url` in a new tab.
- [ ] If `item.owner` is absent, the byline row is not rendered.
- [ ] If both `item.snippet` and `item.summary` are absent, the excerpt and its divider are not rendered.

### Insert mode control
- [ ] The three buttons are labeled "Citation", "Text", and "Citation + text" — not "Reference", "Contents", "Both".
- [ ] No button label is truncated or clipped at default sidebar width.
- [ ] Clicking an insert mode button updates only the `.voices-insertion-summary` text; the card HTML is not re-rendered.
- [ ] The `aria-checked` attribute and `is-active` class move correctly to the clicked button.

### Transliteration control
- [ ] The transliteration control is a `<select>` element with options: "None", "Simplified", "Traditional", "Modern Israeli".
- [ ] No option label is abbreviated or truncated.
- [ ] The selected value from `#voices-translit-select` is read correctly by the insert handler in `footer-actions.html`.

### Insertion summary
- [ ] The `.voices-insertion-summary` line reads "Will insert: Citation only" when Citation is active, "Will insert: Full text" for Text, "Will insert: Citation + text" for Citation + text.
- [ ] The element has `aria-live="polite"` so screen readers announce updates.

### Copy
- [ ] The text "Use the Open button below" does not appear anywhere in the rendered UI.

### Accessibility
- [ ] The content card has `role="region"` and `aria-label="Selected sheet preview"`.
- [ ] The transliteration `<select>` is associated with its label via `aria-labelledby`.
- [ ] The excerpt toggle has `aria-expanded` set correctly in both collapsed and expanded states.
- [ ] All interactive elements are reachable and operable by keyboard alone.

### Functional parity
- [ ] Inserting with "Citation" mode calls `insertSheet` with `insertMode: 'reference'` (data-value unchanged internally).
- [ ] Inserting with "Text" or "Citation + text" shows the `.voices-fetch-loading` indicator during the async call.
- [ ] The session library is updated on successful insert (existing behavior unchanged).

---

## 9. Optional Enhancements

These are future improvements, explicitly out of scope for the current redesign. Do not implement alongside the changes above.

### 9.1 Persist transliteration preference across sessions
Save the selected transliteration scheme to `saveAccountPreference({ transliteration_scheme: val })` (matching the pattern used for `search_mode` in `mode-controller.html`). Restore on sidebar load. Low effort, high value for repeat users.

### 9.2 Inline sheet pagination / "Next result" shortcut
A lightweight `< >` control near the card title that advances to the next or previous result without returning to the result list. Useful when scanning multiple results quickly. Requires tracking the current result index.

### 9.3 Sheet cover image or topic color accent
Sefaria source sheets sometimes have associated images. A small thumbnail (32×32px) in the card header, or a left-border color accent keyed to the primary topic category, would improve visual scannability. Requires API support.

### 9.4 Voices session library history
After inserting a sheet, surface it in the session library sidebar section (already used by Texts tab). The `upsertSessionEntry` call in `footer-actions.html` already does this — ensure it is wired correctly for Voices and that the library section is visible in Voices mode.

### 9.5 "Copy citation" quick action
A small icon button next to "Open ↗" that copies the formatted citation to the clipboard without inserting into the document. Useful for users who prefer to paste manually.

