# Product Requirements Document (PRD) v2
## Torah Library / Google Docs Add-on

**Version:** 2.0  
**Date:** April 14, 2026  
**Basis:** Consolidated from complaint patterns and uploaded expected-behavior specifications

---

# 1. Document Purpose

This PRD defines the product, UX, architecture, and hardening requirements for the Google Docs add-on. It consolidates:

- recurring complaint-driven fixes
- expected behavior for the Preferences modal
- expected behavior for the Sidebar UI/UX
- Experimental Features architecture
- Search Results behavior
- insertion rules
- footer behavior
- session library expectations
- code ownership and regression-prevention guardrails

This document is intended to serve as the **single master requirements document** for the stabilization and modernization of the add-on.

---

# 2. Product Vision

The add-on should feel like a **stable, trustworthy, compact, human-centered authoring tool** inside the constraints of a narrow Google Docs sidebar and modal environment.

It must prioritize:

- predictability over cleverness
- stability over dynamic UI tricks
- shared-state consistency over duplicated controls
- compact clarity over clutter
- maintainable architecture over patch accumulation

The add-on should make users feel confident that:

- a setting means the same thing everywhere
- a toggle worked when clicked
- preview reflects what will be inserted
- search results are understandable and controllable
- fixes in one area will not silently break another

---

# 3. Product Principles

## 3.1 UX Principles

The experience must be:

- **Stable**
- **Predictable**
- **Responsive**
- **Readable**
- **Compact enough for a ~300 px sidebar**
- **Consistent between Preferences and Sidebar session controls**

Users should never need to infer:

- whether a setting is a saved default or a session override
- whether a control affects preview, inserted output, or both
- whether a click registered
- whether a feature is active even though nothing visible changed
- whether modal and sidebar settings disagree

## 3.2 Audience Constraints

Assume users may be:

- highly educated
- older and sensitive to clutter
- technically literate but not expert in debugging UI state
- especially frustrated by hidden behavior, shifting layouts, and inconsistent semantics

Therefore the product must emphasize:

- large enough targets
- visible grouping
- immediate response
- minimal surprise
- strong state consistency

## 3.3 Core Mental Model

```plaintext
Preferences → saved defaults
Session State → current working state
Sidebar → edits session state
More Options / Preview pills → session overrides
Preview → reflects session state
Insertion → reflects effective session state
```

This model must be maintained consistently across the system.

---

# 4. Problem Statement

The current add-on creates friction because:

- controls shift, wrap, or reflow during use
- patches can target the wrong section
- some controls are missing where users expect them
- some toggles do not function
- modal and sidebar settings drift out of sync
- experimental features do not produce visible, meaningful UI changes
- search behavior is insufficiently structured and can feel unstable
- insertion behavior can duplicate or misplace metadata
- footer behavior is crowded or inconsistent
- logic ownership is fragmented, allowing regressions through late overrides and brittle patching

These failures reduce trust and create a sense that the add-on is fragile.

---

# 5. Goals

## 5.1 Primary Goals

- Eliminate layout shift and jarring control movement
- Define a clear, shared state model for defaults, session state, and overrides
- Ensure Preferences and Sidebar use the same settings semantics
- Make preview immediate and trustworthy
- Make experimental features visible, stateful, and coherent
- Define search results behavior that is stable, filterable, and easy to scan
- Clean up insertion behavior so linked title and citation are distinct and correctly placed
- Stabilize footer behavior and action visibility
- Prevent regressions through clear module ownership and hardening checks

## 5.2 Secondary Goals

- Reduce maintenance risk from monolithic files and override-based patching
- Preserve direct access to important tools like Session Library
- Keep the UI compact without becoming cramped
- Make future enhancements safer because the product model is explicit

---

# 6. Non-Goals

This PRD does not require:

- a full visual redesign disconnected from current workflows
- framework migration unless later justified
- experimental expansion beyond the architecture defined here
- replacing core product behavior with a wholly new interaction model

---

# 7. Information Architecture

## 7.1 Top-Level Product Surfaces

The product consists of:

- **Sidebar**
- **Preferences Modal**
- **Preview surfaces**
- **Search results and result detail behavior**
- **Footer actions**
- **Session Library**
- **Experimental Features area**

## 7.2 Top-Level Sidebar Tabs

The Sidebar should expose:

- **Texts**
- **Voices**
- **Experimental** only when enabled

There must be **no global Basic vs Advanced primary mode model**.

Any advanced behavior should be contextual, not a primary top-level navigation concept.

---

# 8. State Architecture and Synchronization

## 8.1 Canonical State Layers

The system must explicitly support:

### A. userPreferences
Saved defaults for the user.

### B. sessionState
The current active working state for the present session.

### C. effectiveState
The state currently reflected in UI, preview, and insertion behavior, normally derived from sessionState.

## 8.2 Required Lifecycle

### On app load
```js
sessionState = deepCopy(userPreferences)
```

### During sidebar use
- Sidebar edits update `sessionState`
- More Options / preview pill edits update `sessionState`
- Preview reflects `sessionState`

### Save as Defaults
```js
userPreferences = deepCopy(sessionState)
```

### Reset Session to Defaults
```js
sessionState = deepCopy(userPreferences)
```

### Cancel / Close in Preferences
- closes without saving
- does not alter current session state

## 8.3 Critical Rules

- Preferences define **defaults**
- Sidebar defines **current working behavior**
- More Options and preview pills are **session override controls**
- Preview always reflects **session state**
- Insertion uses the current effective session state
- Preferences must not silently force live changes unless explicitly applied

## 8.4 Synchronization Requirements

All shared settings must read/write through a **single source of truth**.

The following must always stay synchronized:

- Preferences modal
- Sidebar controls
- More Options / compact pills
- Preview
- insertion behavior
- footer readiness states where relevant
- experimental visibility states

## 8.5 Settings Parity Contract

### The Paradigm

Every **insertion-impacting setting** must exist in **both** of the following surfaces with consistent semantics and identical behavior:

1. **Preferences modal** — controls the saved user default, applied at sidebar load
2. **More Options panel in the sidebar** — controls the current session override, applied immediately and reversibly

The user must be able to look at the Preferences composition preview and the sidebar More Options composition card and recognize they are controlling the same settings with the same logical groupings.

### Canonical List of Insertion-Impacting Settings

The following settings are **insertion-impacting** and must participate in the parity contract. Font settings (`*_font`, `*_font_size`, `*_font_style`) and transliteration character-override maps (`transliteration_overrides`) are excluded from parity because they require specialized UI that does not belong in the compact sidebar.

| Preference Key | Preferences Label | More Options Label | UI Type |
|---|---|---|---|
| `insert_sefaria_link_default` | Link source title before inserted text | 🔗 Title | Toggle pill |
| `insert_citation_default` | Include source citation after inserted text | 🧾 Citation | Toggle pill |
| `nekudot` | Vowels (niqqud) | ◌ְ Vowels | Toggle pill |
| `teamim` | Cantillation (teamim) | ◌֑ Cantillation | Toggle pill |
| `include_transliteration_default` | Include transliteration | Aא Translit | Toggle pill |
| `transliteration_scheme` | Transliteration scheme | Scheme selector (attached to Translit pill) | Compact dropdown |
| `show_line_markers_default` | Line markers | ¶ Lines | Toggle pill |
| `include_translation_source_info` | Translation details | ⓘ Details | Toggle pill |
| `output_mode_default` | Display mode (Original / Bilingual / Translation) | Display chooser | Card selector |
| `bilingual_layout_default` | Bilingual layout (Stacked / Right–Left / Left–Right) | Layout chooser | Card selector |

### Rules for Parity

1. Every setting in the table above must be editable in **both** Preferences and More Options.
2. A change in **More Options** must write to `sessionPreferences` and update `effectivePreferences` immediately without touching `accountPreferences`.
3. A change in **Preferences** must write to `accountPreferences` and must not silently overwrite `sessionPreferences` or `effectivePreferences` without an explicit apply action.
4. The sidebar's `effectivePreferences` is always `merge(accountPreferences, sessionPreferences)`.
5. **"Save as Defaults"** in More Options must promote all session overrides for settings in this table to `accountPreferences` and then clear `sessionPreferences`.
6. **"Reset to Defaults"** in More Options must clear `sessionPreferences` for all settings in this table and re-derive `effectivePreferences` from `accountPreferences`.
7. Both surfaces must use the **same preference key names** when reading and writing.
8. `mergePreferenceDefaults()` must correctly populate the sidebar's hidden checkbox state for every key in this table.
9. Every pill toggle in More Options must have a corresponding backing DOM element whose state drives the preference write. The backing state model must not be implicit in the pill's visual state alone.

### Enforcement

The `SETTINGS` array in `Code.gs` must include all preference keys in this table. Any key missing from `SETTINGS` will not be saved or loaded through the standard preferences engine and must be treated as a defect.

---

# 9. Functional Requirements: Preferences Modal

## 9.1 Purpose

The Preferences modal is the user’s saved default configuration surface. It is not the primary live interaction layer.

It must:

- define stable saved defaults
- enable or disable system-level features
- provide a predictable baseline for each session

## 9.2 Required Sections

The Preferences modal must contain:

1. **Texts Defaults**
2. **Voices Defaults**
3. **Experimental Features**

## 9.3 Texts Defaults

Preferences must support default configuration for:

- language layout
- display layout
- translation selection
- include citation below text
- include transliteration
- include niqqud / vowels
- include cantillation
- source title linking behavior
- any other shared insertion/display semantics used by Sidebar

These values:

- populate the Sidebar on load
- do not override live session changes unless explicitly applied or reset
- require explicit save to persist

## 9.4 Voices Defaults

Preferences must define default voice-related settings using the same pattern as Texts:

- sets defaults only
- does not immediately override session behavior
- persists when explicitly saved

## 9.5 Experimental Features Section

This section is the sole gatekeeper for experimental system-level activation.

It must include, in this order:

- **Enable Experimental Features** — master toggle (gates visibility of all items below)
- **AI Mode** — toggle, visible only when master is on
- **Surprise Me** — toggle, visible only when master is on

### Master Toggle Behavior

The master toggle must:
- When turned **off**: hide and disable all child experimental toggles; mark all experimental flags as disabled; remove the Experimental sidebar tab
- When turned **on**: reveal the AI Mode and Surprise Me child toggles in their last-saved state; the Experimental sidebar tab appears only if at least one child toggle is also on

### Child Toggle Behavior
Enabling a child toggle must:

- immediately set the state flag in `accountPreferences`
- cause the Experimental sidebar tab to appear (if not already visible)
- update footer action behavior as required
- produce a visible, immediate UI change — a toggle must never appear to do nothing

Experimental features must **not** be activated only from ad hoc sidebar-only controls.

## 9.6 Buttons and Actions

The Preferences modal must include:

- **Save as Defaults**
- **Reset to My Defaults**
- **Cancel / Close**

### Save as Defaults
- persists changes to userPreferences
- does not require reload

### Reset to My Defaults
- restores modal values from saved userPreferences
- does not alter current session unless explicitly applied

### Cancel / Close
- dismisses the modal without saving
- does not alter sessionState

## 9.7 Preview in Preferences

Optional but recommended.

If present, it must:

- reflect the **default configuration**
- not interfere with live sidebar preview
- clearly indicate it is showing defaults, not the current session

---

# 10. Functional Requirements: Sidebar

## 10.1 Sidebar Flow

The sidebar should proceed vertically in this order:

1. mode switcher / tab selector
2. search row
3. result lists
4. Display & Layout
5. More Options
6. Preview / versions / composition controls
7. Footer actions
8. Help / logo / feedback strip

All major sections must stack full width.  
No major sections may accidentally render side-by-side due to malformed wrappers.

## 10.2 Layout System

The sidebar must use a **stable, strict three-column layout** for relevant control rows:

| Column | Content | Behavior |
|---|---|---|
| 1 | Label | Left-aligned, fixed width |
| 2 | Control | Left-aligned, fixed width |
| 3 | Optional input | Flexible but bounded |

### Rules
- no flex-based reflow that shifts adjacent controls
- label and control widths must be stable
- the optional input fills remaining space without pushing other columns
- rows align vertically across sections
- controls must not wrap unpredictably because a dropdown expanded

### Explicitly forbidden
- right-aligned selectors that push other content
- custom text inputs wrapping to a second row because another control resized
- jumpy layout during interaction

## 10.3 Control Behavior

### Dropdowns
- open as overlays
- do not push layout
- show selected value clearly
- preserve stable row layout

### Toggles
- respond immediately
- clearly show on/off state
- persist according to the state model
- sync with Preferences and all mirrored controls

### Text Inputs
- stay in a fixed position
- do not resize based on content
- do not shift because neighboring controls changed

## 10.4 More Options / Interactive Preview Controls

The More Options accordion must sit:

- below Display & Layout
- above lower-priority content
- not in the footer

Its header should contain:

- title
- compact **Reset**
- compact **Save**

### Primary compact session controls
The preview card should host compact pill controls for:

- `🔗 Title`
- `🧾 Citation`
- `◌ְ Vowels`
- `◌֑ Cantillation`
- `Aא Translit`

The transliteration scheme selector must be compact and attached to transliteration controls.

These must be:

- pill-style
- icon + short text
- keyboard accessible
- tooltip-enabled
- high-contrast
- immediate in effect

### Secondary compact controls
Below the preview card, lower-priority compact controls should include:

- `¶ Lines`
- `ⓘ Details`

Oversized legacy switch rows must no longer be the primary sidebar UI for these session overrides.

## 10.5 Responsiveness Parity

The Sidebar must feel as responsive as Preferences.

Therefore:

- controls update immediately
- preview updates immediately
- visible pills/toggles update immediately
- persistence may happen in the background

The Sidebar must not feel slower or more confusing than Preferences.

## 10.6 Sidebar Display Bounds and Overflow Prevention

The sidebar operates inside Google Docs' sidebar iframe, which is **300px wide** and constrained to the available browser window height. Everything the user needs to see and interact with must fit within this frame.

### Hard Requirements

- **No element may render outside the sidebar frame.** This includes dropdowns, popup menus, transliteration scheme selectors, and any accordion or panel that expands.
- **All scrollable content must be inside `.sidebar-scroll`.** This is the sole scroll container. Every section — including the experimental section — must be a child of `.sidebar-scroll` so it participates in scrolling rather than clipping or overflowing.
- **Absolute-positioned panels must be contained.** Display/Layout choosers, the transliteration scheme dropdown, the restore-corpus menu, and any other inline panel must use `position: absolute` within a `position: relative` parent that is itself inside the sidebar frame. They must not use `position: fixed`.
- **`overflow: hidden` on the outer container is not a substitute for correct layout.** Content hidden by overflow clipping is inaccessible and must be treated as a bug.

### Overflow Prevention Rules

- The `<main>` container uses `height: 100vh; overflow: hidden` only as a frame boundary. All user-accessible content must be inside `.sidebar-scroll` with `overflow-y: auto`.
- No section may be placed between `.sidebar-scroll`'s closing tag and `</main>`. Doing so creates a non-scrollable dead zone.
- Menus and dropdowns that would overflow the sidebar's right or bottom edge must be repositioned (e.g., right-aligned or scrolled into view) rather than clipped.
- The experimental section, which may contain multiple form accordions, must scroll with the rest of the sidebar content.

### Minimum Interaction Target Size

All interactive controls (buttons, pill toggles, checkboxes, select controls) must present a minimum clickable area of **28 × 28 px** to support users with reduced fine motor precision. Label-clicking via `<label for>` counts toward this target.

---

# 11. Functional Requirements: Search and Results

## 11.1 Search as Core Product Behavior

Search is a core feature and must not regress because of unrelated changes to footer, display, layout, preview, or composition modules.

## 11.2 Search Triggers

All of the following must work:

- click magnifying glass
- press Enter in search box
- debounced typing search

## 11.3 Search Modes

### Texts mode
Must support:
- direct ref validation
- search-wrapper results
- library/title matching
- rendering library and search buckets correctly

### Voices mode
Must support:
- source sheet search
- voice-specific result rendering
- add/open behavior appropriate to sheets

## 11.4 Search Results Layout

Search results should appear as a vertical list of result cards.

Each result card should contain:

- Title
- Metadata row
- Snippet / preview text
- Tags / indicators
- Optional actions

### Rules
- consistent width
- consistent padding
- title prominent and left-aligned
- snippet truncated cleanly
- tags visible but not dominant
- no horizontal shifting
- no unpredictable expansion

## 11.5 Sorting

The UI must provide a visible **Sort by** control aligned with filters.

Supported modes should include at minimum:

- Relevance (default)
- Title (A–Z)
- Category / type
- Recently Added / Updated
- Custom/domain-specific if needed

Sorting must:

- update immediately
- preserve current filters
- be deterministic
- be visually clear

## 11.6 Filtering

Filters must be:

- visible and accessible without relying on modals for basic filtering
- multi-select where appropriate
- clearly active when selected

Supported filter types may include:

- category filters
- source type
- language
- tags
- time-related filters
- boolean toggles where appropriate

### Active filters
Active filters must be visible as chips above results.

The user must be able to:

- remove an individual filter
- clear all filters

Filters must not:

- reset unrelated settings
- require a page refresh
- create layout instability

## 11.7 Grouping

Grouping should support organization by:

- category
- topic
- date
- other domain-relevant groupings

Group headers must:

- be visually distinct
- be stable during filtering
- not disrupt result card layout

Sorting should still apply within groups.

## 11.8 Coloring

Color may be used for:

- category indicators
- selected states
- match highlighting

But color must not be the only carrier of meaning.

The system must provide:

- consistent category colors
- labels or icons in addition to color
- accessible highlighting

## 11.9 Empty, Loading, and Transition States

### Empty state
When there are no results, the UI must show:

- a clear “No results found” message
- guidance to adjust filters or terms
- a clear filters option where relevant

### Loading
Use skeletons or stable loaders that preserve layout shape.

### Transitions
Changing sort, filters, grouping, or search input must not:

- flicker
- collapse the layout
- reorder results mysteriously

## 11.10 Result Behavior and Corpus Handling

The following must work correctly:

- results render in the correct regions
- selected result is visually highlighted
- result summary row updates when collapsed
- pinning works
- corpus hide/restore works
- restoring hidden corpora must not recurse or overflow the stack
- restore corpus must not unexpectedly affect session library behavior

---

# 12. Functional Requirements: Preview

## 12.1 Preview as Trust Surface

Preview is a trust surface. It must update immediately whenever a relevant setting changes.

This includes:

- title link setting
- citation inclusion
- vowels / niqqud
- cantillation
- transliteration on/off
- transliteration scheme
- display mode
- layout mode
- line markers
- translation details
- version selections

The preview must never visibly lag behind the current control state.

## 12.2 Preview Content Ordering

Expected default ordering when enabled:

1. linked title preview
2. Hebrew / source text
3. transliteration
4. translation or bilingual layout
5. citation block

This may vary slightly by mode/output selection, but the meaning must remain consistent and predictable.

## 12.3 Transliteration Behavior

When transliteration is enabled:

- transliteration appears in preview
- disappears immediately when disabled
- changing the transliteration scheme updates preview immediately
- sidebar responsiveness for transliteration must match Preferences responsiveness

---

# 13. Functional Requirements: Display & Layout Choosers

The Display and Layout choosers must:

- open as compact panels
- use useful sidebar width
- not clip contents
- close on outside click
- close after relevant selection when appropriate
- not remain awkwardly cramped inside tiny tiles

They must not:

- overflow horizontally
- wrap in broken ways
- clip icons/text
- push neighboring sections sideways

---

# 14. Functional Requirements: Footer

## 14.1 Footer Purpose

The footer is the stable action area of the sidebar. It must remain visually anchored, easy to scan, and context-aware without becoming unpredictable.

## 14.2 Footer Structure

The footer should have:

1. divider / separation zone
2. primary footer action rows
3. optional helper/status line if needed

### Required row structure

#### Row 1
- **Add Source**
- **Open in Sefaria**

`Add Source` must be wider and more prominent.

#### Row 2
- **Actions**
- **Preferences**
- **Session Library**

Session Library must remain directly visible, not buried.

## 14.3 Footer Visual Rules

- consistent padding
- consistent spacing between buttons
- consistent typography
- subtle divider above footer
- consistent hover/focus/disabled styles
- stable button height and corner radius

## 14.4 Footer State Rules

### Add Source
Enabled only when a valid insertable selection exists.

### Open in Sefaria
Enabled only when a valid text or sheet selection exists.

Buttons must have:

- visible inactive outline
- clear active/ready state
- clear disabled appearance
- no ambiguity about clickability

## 14.5 Actions Panel

The Actions button may open a compact panel.

It should:

- behave like the Display/Layout chooser
- close on outside click
- close after selection
- show standard actions in Texts/Voices
- show experimental actions in Experimental mode

## 14.6 Standard vs Experimental Footer Content

### Standard mode
Show standard quick actions cleanly.

### Experimental mode
Replace standard quick actions with the AI-driven quick actions where required by the product mode.

This replacement must be:

- immediate
- clean
- reversible
- structurally stable

It must not produce:

- mixed clutter
- stacked duplication
- stale modal-era action leftovers
- drastic footer height changes

## 14.7 Footer Anti-Bloat Rule

The footer must not include:

- anchored Session Settings controls
- duplicated More Options content
- oversized utility rows
- orphaned modal-launch behavior no longer relevant

---

# 15. Functional Requirements: Experimental Features

## 15.1 Product Decision

Experimental behavior must no longer feel hidden, modal-fragmented, or visually inert.

A dedicated **Experimental** sidebar tab must exist when relevant experimental features are active.

## 15.2 Visibility Rules

The Experimental tab:

- appears only when at least one experimental feature is active
- uses a clear label such as **Experimental Features**
- may use the 🧪 icon and tooltip where appropriate

If no experimental features are active:

- the Experimental tab should not appear
- the interface should not be cluttered by empty experimental areas

## 15.3 Activation Rules

When the user turns on:

- Surprise Me, or
- AI Mode

the UI must visibly and immediately change by:

- showing the Experimental tab
- showing the relevant feature controls there
- updating footer behavior where applicable

A toggle must never appear to do nothing.

## 15.4 Experimental Tab Content Model

Active experimental features should appear as **accordions** inside the Experimental tab.

Each active feature receives its own accordion, such as:

- Surprise Me
- AI Shiur / AI-assisted feature set

### Accordion behavior
- independently expandable/collapsible
- clearly labeled
- state visible in header
- concise explanatory microcopy
- feature controls in body
- no unnecessary duplication of controls from elsewhere

## 15.5 Surprise Me Requirements

When enabled:

- the Experimental tab appears
- the Surprise Me accordion appears
- activation is clearly visible
- any randomness scope/settings are available if supported

When disabled:

- its active accordion disappears from the active experimental area
- the UI updates immediately

## 15.6 AI Feature Migration Rule

AI Shiur / AI-assisted controls should no longer be stranded as a disconnected modal-first workflow when the new Experimental tab architecture is active.

The sidebar Experimental area should become the primary persistent home for these controls unless there is a very specific advanced reason to preserve a modal.

This avoids:

- desync risk
- duplicate logic
- user confusion
- maintenance burden

---

# 16. Functional Requirements: Insertion Behavior

## 16.1 Correct Insertion Order

Insertion must behave as follows when enabled:

### Optional A
Linked source title **before** inserted text

### Main content
Inserted text

### Optional B
Citation block **after** inserted text

## 16.2 Distinct Features

Title link and citation are distinct features and must remain distinct in:

- Preferences
- Sidebar
- insertion implementation

## 16.3 Forbidden Outcomes

The system must not:

- append duplicate title-only metadata below inserted text
- combine title-link and citation in the wrong order
- create duplicated metadata blocks because of split-state confusion

---

# 17. Functional Requirements: Session Library

## 17.1 Visibility

Session Library must remain visible and directly accessible from the footer.

## 17.2 Responsibilities

Session Library must correctly support:

- recent inserted items
- pinned items
- corpus grouping/filtering
- opening stored items
- removing items
- pinned/unpinned state
- stable rendering

## 17.3 Stability Rules

Session Library helpers such as `buildSessionEntry` must have single ownership and must not be wrapped recursively.

Session Library logic must not be accidentally mixed into footer patches or result rendering patches.

---

# 18. Architecture and Ownership Requirements

## 18.1 Hard Separation of Concerns

The codebase must separate:

### Backend contract layer
Apps Script functions that handle:
- Sefaria APIs
- document insertion
- preferences persistence
- sidebar opening
- sidebar session persistence
- voice/source search APIs

### Client state/preference plumbing
Dedicated state and preference modules.

### Search orchestration
Dedicated search controller.

### Rendering
Separated by feature:
- results rendering
- preview rendering
- session library rendering
- footer rendering/state
- display/layout chooser rendering
- composition controls

### Styling
CSS-only files using classes/toggles, not logic-embedded styling.

## 18.2 Load Order Must Not Determine Correctness

No core feature may depend on:

- late redefinition
- overwrite-based patching
- include-order luck

Every important function must have a single authoritative owner.

## 18.3 Sidebar Core Must Be Thin

A monolithic `sidebar_js.html` should not continue as the dumping ground for:

- rendering
- preview logic
- search logic
- footer logic
- event wiring
- session library logic
- mode logic

## 18.4 Intended Module Ownership Model

The implementation should separate ownership roughly as follows:

### Backend
- `Code.gs`

### Shared client helpers
- `ui_api.html`
- `ui_dom.html`
- `ui_feedback.html`
- `ui_state.html`

### Sidebar-specific client modules
- `sidebar_preferences_state.html`
- `sidebar_search_utils.html`
- `sidebar_search_controller.html`
- `sidebar_results_render.html`
- `sidebar_session_library.html`
- `sidebar_preview_core.html`
- `sidebar_composition_controls.html`
- `sidebar_display_controls.html`
- `sidebar_footer_actions.html`
- `sidebar_mode_controller.html`
- `sidebar_event_bindings.html`
- `sidebar_bootstrap.html`

This ownership model is not merely organizational; it is a product reliability requirement.

---

# 19. Runtime Hardening and Regression Guardrails

## 19.1 Duplicate Ownership Prohibition

Every important function must be defined once.

There must be no duplicate ownership of core functions such as:

- `runUnifiedQuery`
- `resolveSelectedResult`
- `refreshSelectedResult`
- `renderResults`
- `renderSessionLibrary`
- `setFooterButtonStates`
- `setInsertButtonState`
- `setSidebarMode`
- `updateModeDependentSections`
- `updateSuggestion`
- `buildSessionEntry`

## 19.2 No Late-File Override Strategy

Do not rely on:

- redefining functions later in the file
- patch modules that replace earlier implementations
- include-order dependent overrides

## 19.3 Static Preflight Requirements

Before deployment, the codebase should pass checks for:

- no duplicate basenames
- balanced `<style>` / `</style>`
- balanced `<script>` / `</script>`
- `sidebar_css.html` ending with exactly one final `</style>`
- extracted HTML script bodies parse with `node --check`
- raw `.js` files parse with `node --check`
- search smoke checks scanning all split modules, not only legacy files

## 19.4 Mandatory Smoke Test Sequence

Before a build is treated as good, test in this order:

1. Texts search
2. Select text result
3. Preview updates
4. Add Source
5. Open in Sefaria
6. Session Library open / recent / pinned
7. More Options pills
8. Transliteration preview
9. Display/Layout chooser
10. Voices search
11. Footer Actions / Preferences / Session Library
12. Corpus hide and restore
13. Save session as defaults
14. Reset session overrides

---

# 20. Accessibility Requirements

The product must ensure:

- all controls keyboard accessible
- logical tab order
- visible focus states
- toggles not color-only
- labels clear and unambiguous
- accordions keyboard operable
- tooltips available for compact/icon-heavy controls where needed
- disabled states visually and semantically distinct

---

# 21. Anti-Patterns to Avoid

Do not reintroduce:

- monolithic `sidebar_js.html` as the everything-file
- large toggle rows in Sidebar for session overrides
- Basic/Advanced as a primary sidebar mode model
- duplicate title-link insertion below text
- footer utility sprawl
- accidental side-by-side rendering of major sections
- search/session library/footer logic mixed into patch files
- quality checks that assume outdated file ownership patterns
- flex layouts that reflow core row structure unpredictably

---

# 22. Acceptance Criteria

The product is considered correct for this PRD milestone only when:

## State and Sync
- Preferences define defaults
- Sidebar edits session state
- Save as Defaults persists session state to preferences
- Reset Session restores preferences into session state
- no desync exists between modal, sidebar, preview, and insertion behavior

## Sidebar UX
- no layout shift occurs during normal interaction
- control rows remain aligned
- dropdowns do not push other elements
- compact session override pills work and update immediately

## Search
- search triggers work reliably
- results render in correct regions
- sorting/filtering/grouping are visible and stable
- active filters are always visible
- empty/loading states are clear and stable
- corpus restore works without recursion or stack overflow

## Preview
- preview updates immediately for all relevant settings
- transliteration and scheme changes are reflected immediately
- preview order is trustworthy and consistent

## Footer
- footer remains anchored and stable
- Add Source and Open in Sefaria obey readiness rules
- Actions/Preferences/Session Library remain accessible
- standard and experimental modes swap cleanly without clutter

## Experimental
- turning on Surprise Me causes an immediate visible UI change
- Experimental tab appears only when relevant
- active experimental features appear as accordions
- AI experimental controls are no longer stranded in disconnected modal-only flows

## Insertion
- title link and citation are distinct
- insertion order is correct
- no duplicate metadata appears below inserted text

## Hardening
- important functions have one owner
- no override-based correctness remains
- preflight checks pass
- smoke tests pass in the required sequence

---

# 23. Priority Ranking

## P0
- shared state model and sync correctness
- **settings parity contract enforced** — all insertion-impacting settings in both Preferences and More Options, with correct backing DOM elements
- **vowels and cantillation pill toggles functional** — `.wants-vowels` and `.wants-cantillation` DOM elements present and wired
- **transliteration on/off pill functional** — `#sidebar-transliteration-pill` or equivalent DOM element present and wired
- **restore-corpus dropdown DOM present** — `#restore-corpus-menu`, `#restore-corpus-menu-wrap`, `#restore-corpus-menu-items` in sidebar.html
- **experimental tab appears after bootstrap** — `applyEffectivePreferencesToUI()` calls `syncExperimentalAvailability()`
- **no element renders outside sidebar frame** — experimental section inside `.sidebar-scroll`, all panels contained
- stable sidebar layout
- immediate trustworthy preview
- search reliability
- correct insertion behavior
- functional toggles including Surprise Me
- footer stability
- balanced output tags and no duplicate `</style>`

## P1
- master experimental toggle in Preferences (gates child toggles)
- Experimental tab/accordion architecture
- modular ownership cleanup
- Session Library accessible in experimental mode
- `insert_citation_default` in SETTINGS array verified
- duplicate event handler cleanup (mode-card, layout-option)
- dead code removal (unused `initializePreferenceState`, redundant IIFE)
- filter/sort/grouping polish
- preflight hardening checks extended to DOM element existence

## P2
- "Recent" sort implemented with actual recency ordering
- further visual refinement
- advanced domain-specific search/grouping enhancements
- additional progressive disclosure improvements
- three-column grid enforcement for More Options control rows

---

# 24. Definition of Done

This PRD is fulfilled when the add-on has reached a state where:

- the UI is compact, stable, and predictable
- the meaning of shared settings is identical across all surfaces
- defaults, session state, and overrides are clearly separated
- preview is trustworthy enough to serve as the user’s confidence surface
- search, insertion, footer, and session library work without regressions
- experimental features have a coherent visible home
- architecture prevents unrelated fixes from breaking core product behavior

The governing principle is:

> **Same settings, same meanings, clear ownership, compact live UI, and no fragile overrides.**
