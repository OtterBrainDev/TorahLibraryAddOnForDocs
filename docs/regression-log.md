# Regression log

Every bug that has regressed silently — fixed and reappeared, or was
silently introduced during a refactor — earns a row here with the
pinning test that now holds it down. A bug can be wrong in this repo at
most twice.

Columns:

- **Bug**: one-line description.
- **First seen**: when the behavior broke the first time (commit SHA
  or date).
- **Re-seen**: when it broke again, if applicable.
- **Root cause category**: the anti-pattern, so similar bugs can be
  recognized.
- **Pinning test**: the test file and (where useful) test name that
  will turn red if the bug reappears.
- **Rule**: the one-sentence do-not-do rule that also appears in
  `AGENTS.md`.

| Bug | First seen | Re-seen | Root cause category | Pinning test | Rule |
| --- | ---------- | ------- | ------------------- | ------------ | ---- |
| Divine-name substitution silently stopped applying on insert for upgrading users. | rewrite branch introduction of `apply_sheimot_on_insertion` (~2026-02) | — | **new opt-in gate without migration**: a new preference key was added defaulting to `false`; existing users who had substitutions on before never got them turned back on. | `test/tests/hebrew-preferences.test.js` — "applies Hebrew divine-name replacements after display normalization" pins the gate-on path; `test/tests/migrations.test.js` — "upgrading user without apply_sheimot_on_insertion gets it set to 'true'" pins the upgrade path (Stage 2). | Never add a new preference key that gates existing behavior without a default of `true` *and* an `apply_sheimot_on_insertion`-style migration. |
| `extendedGemaraPreference` module-scope global set but only read on sidebar-open paths; Quick-Actions menu callers see stale `false`. | rewrite branch refactor of `openSharedSidebar_` | — | **dead-scoped global**: the setter is conditional, the reader runs unconditionally. | `test/tests/extended-gemara.test.js` — "reads `extended_gemara` at call time" and "the dead module-scope global is gone" (Stage 2). | Module-scope globals that hold preferences are a smell. Read preferences at call time, not at sidebar-open time. |
| `formatDataForPesukim` appends a newline even when `pesukim` is `false`, changing inserted-document spacing. | rewrite branch (`Code.gs:759`) | — | **output-shape change without a snapshot test**. | `test/tests/format-data-for-pesukim.test.js` — "pesukim=false: verses are joined as prose with a single space (no trailing newlines)" (Stage 2). | Insertion-path output has snapshot tests. Do not "simplify" formatting paths without first updating the snapshot. |
| "Refresh Sidebar" button in preferences calls `google.script.run.refreshSidebarAfterPreferences()` — server function did not exist, click silently no-opped. | unknown (the client call is at `apps-script/preferences/js.html:791`; the server binding was either renamed or never landed) | — | **server refactor renames/removes a function the client still calls**: the failure path is silent because no `withFailureHandler` is attached. | `test/ui/rpc-surface.test.js` — "every google.script.run.X call in client HTML resolves to a surface-listed function". The server binding was restored in Stage 2 (`refreshSidebarAfterPreferences` reopens the sidebar, giving a fresh session). | Every client `google.script.run.X` call must resolve to a server function listed in `docs/rpc-surface.json`. The contract test enforces it. |
| Session-modal positioning / help-card hover broke repeatedly (multiple commits in the branch history). | several rounds | several rounds | **CSS-token drift**: inline `<style>` values in entry templates duplicated tokens already defined in `apps-script/css/tokens.html`; copies drifted. | Stage 6 will consolidate inline styles into the token file. There is no test for CSS visuals; the guardrail is "do not duplicate values already in `css/tokens.html`" plus the Stage 6 consolidation. | Edit `apps-script/css/tokens.html` for spacing / color / sizing values. Do not add inline `<style>` overrides in entry templates. |
| Lexicon-search and voices-clipboard-icon re-breakage (multiple commits). | several rounds | several rounds | **client-side selector contracts not pinned**. The server RPC relies on DOM ids that the UI team would remove or rename during visual rework. | `test/ui/selector-contracts.test.js` + `test/ui/contracts/selector-contracts.json`. Stage 1.5 makes sure every id the server RPC relies on is listed. | Before deleting a DOM id or class, grep `selector-contracts.json` for it. If it's listed, the rename must be bidirectional. |
| `insertReference` accepted nine positional boolean/string parameters; client-side call sites passed them in fixed order and an argument flip silently changed insertion behavior (e.g. passing the title as the language, or the transliteration flag as `insertCitationOnly`). | ongoing pressure across the rewrite | — | **too many positional parameters**: with 9+ params the compiler can't help you when two are reordered; "silent wrong insertion" is the failure mode. | `docs/rpc-surface.json` now pins `insertReference` at arity 2 (`data, opts`). The contract test catches accidental regressions to positional form. | Any server function with more than three parameters takes an options bag. `data` + `opts` is the convention; arity ≤ 2 is enforced by the RPC-surface contract. |

## Process

- Add a row in the same PR that fixes the regression and ships the
  pinning test. The regression log row is part of the fix.
- If an existing row's "Re-seen" column fills up, treat that as a
  signal the pinning test is insufficient or the rule is not yet
  mechanically enforced. Either strengthen the test or promote the
  rule into `pre_clasp_qc.sh`.
- When a test gets stronger and a rule becomes mechanically
  enforceable, move the row into `docs/resolved-regressions.md` with
  a pointer to the enforcing check. (This file does not exist yet;
  create it the first time you need it.)
