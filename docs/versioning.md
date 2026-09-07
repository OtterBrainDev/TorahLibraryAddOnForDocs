# Versioning

For agents (human or AI) changing this add-on. It is short on purpose; the
whole policy is four rules and one coupling that matters more than the rest.

`docs/VERSION.json` is the single source of truth. `test/ui/version-manifest.test.js`
fails if anything drifts from it.

---

## Why this exists at all

Apps Script gives you nothing to hang a version on. `appsscript.json` has no
version field, and `clasp push` overwrites the head deployment in place — there
is no artifact, no tag baked into the bundle, no registry entry. If a user
reports "the linker stopped finding my Rambam citations", nothing in the
deployed code says which build they are on.

So the version is a fact the repository asserts and keeps consistent, rather
than one the platform records. That is fragile by construction, which is why it
is tested.

---

## 1. What the numbers mean

Standard SemVer does not fit — there is no public API and no consumer to break.
The number answers *"what does a user have to know before they upgrade?"*

| Part | Bump when | Examples |
| --- | --- | --- |
| **MAJOR** | Behaviour a user relied on is gone or works differently in a way no migration can paper over. Requires a CHANGELOG entry that says so in the first sentence. | Removing a menu action. Changing insertion output shape so existing documents look different. Dropping a preference with no successor. |
| **MINOR** | New capability, or a behaviour change that a migration handles for existing users. **Any new preference key is at least a MINOR.** | The linker review dialog. Source-emphasis preservation. Colour and highlight controls. |
| **PATCH** | A fix that changes no preference, no output shape, and no user-visible default. | The apostrophe search fix. The htmlToPlainText ordering fix. |

When in doubt, go up. A too-large bump costs nothing; a too-small one hides a
behaviour change from the person deciding whether to upgrade.

## 2. The coupling that actually matters

> **A new preference key requires: a default, a migration, a `PREFS_SCHEMA_CURRENT_`
> bump, a matching `prefsSchemaVersion` in `VERSION.json`, and at least a MINOR
> version bump. All five, in one commit.**

This is AGENTS.md hard rule #1 with the version attached. The reason is
user-data, not bookkeeping: `PREFS_SCHEMA_CURRENT_` is what decides whether an
existing user's stored preferences get migrated. Ship a key without bumping it
and the migration never runs for anyone already installed — which is exactly the
divine-name regression in `docs/regression-log.md`, the one this project has
already paid for once.

The schema version **only ever increases**, and is never reused or rolled back.
A user who has run schema 9 cannot be moved back to 8; the migration driver
compares numerically (`from < N`) and would simply skip everything.

## 3. Where the version appears

Listed in `VERSION.json` under `surfaces`, and checked by the manifest test:

- `apps-script/help-modal.html` — About tab, MAJOR.MINOR only
- `apps-script/release-notes.html` — shown on install

Do not add a third surface without adding it to `surfaces` at the same time. An
unlisted copy is one the test cannot protect, and it will drift.

## 4. Releasing

1. Decide the number using §1.
2. Update `docs/VERSION.json`: `version`, `previous`, `status: "released"`,
   `released` (ISO date), and `prefsSchemaVersion` if a migration shipped.
3. Update every file in `surfaces`.
4. Consolidate the `## Unreleased — …` sections in `docs/CHANGELOG.md` under one
   `## vX.Y.Z — <summary> (YYYY-MM-DD)` heading. Keep the sub-headings (Added /
   Fixed / Changed / Security); they are what a reader scans.
5. `npm ci && npm test` — expect **0 failing and 0 skipped**. A non-zero skipped
   count means `npm ci` did not run and the sanitizer assertions sat out.
6. `bash pre_clasp_qc.sh apps-script` — exit 0.
7. Work `docs/marketplace-listing.md` if scopes or data handling changed.
8. Tag the commit `v2.1.0`. The tag is the only durable record that a given
   commit is what a given user is running.

## 5. For AI agents specifically

- **Never bump the version as a side effect.** If you are asked to fix a bug,
  fix the bug. Version bumps are release decisions, and a bump buried in a fix
  commit makes the history unreadable.
- **Never edit `PREFS_SCHEMA_CURRENT_` without writing the migration.** The
  number is not a label; it gates whether existing users' data gets touched.
- **Never hand-edit a file under `test/ui/snapshots/`.** Regenerate with
  `UPDATE_UI_SNAPSHOTS=1 npm test` and read the resulting diff. A snapshot
  edited by hand has already lost the property it exists to guarantee — this has
  happened here before, and left the suite red on a branch.
- **If a change needs a version bump and you were not asked for one**, say so in
  your summary rather than doing it silently. The person releasing needs to know
  the number moved.
- **State the version you tested against** when reporting results. "Works on my
  branch" is not checkable later; "2.1.0, schema 9" is.
