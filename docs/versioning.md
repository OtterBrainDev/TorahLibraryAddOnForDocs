# Versioning

For agents (human or AI) changing this add-on. It is short on purpose; the
whole policy is one numbering rule and one coupling that matters more than the
rest.

`docs/VERSION.json` is the single source of truth. `test/ui/version-manifest.test.js`
fails if anything drifts from it.

---

## Why this exists at all

Apps Script gives you nothing meaningful to hang a version on. `appsscript.json`
has no version field. `clasp push` overwrites the project's HEAD in place, and
HEAD is only what test deployments run; users run a numbered script version
(`clasp version`) chosen in the Marketplace SDK's App Configuration. Those
numbers (1, 2, 3, …) say nothing about what changed, and nothing is baked into
the bundle. If a user reports "the linker stopped finding my Rambam citations",
nothing in the deployed code says which build they are on.

So when you cut a release, describe the Apps Script version with the add-on
version — `clasp version "v<version>"`, e.g. `"v2.0.2"` — so the two can be
matched later.

So the version is a fact the repository asserts and keeps consistent, rather
than one the platform records. That is fragile by construction, which is why it
is tested.

---

## 1. What the numbers mean

Versions are `MAJOR.MINOR.BUILD`. The add-on is on the **2.0 line**: every
release bumps the build by one — 2.0.1, 2.0.2, 2.0.3 — whatever it contains,
and MINOR stays 0. A new capability, a new preference key and a one-line fix
are all the next build.

Since the number doesn't say how big a release is, the CHANGELOG has to.
It answers *"what does a user have to know before they upgrade?"*:

| A release that… | Its CHANGELOG entry must… | Examples |
| --- | --- | --- |
| Removes behaviour a user relied on, or changes it in a way no migration can paper over | Say so in the first sentence. This is the one change that is not just a build: it means leaving the 2.0 line (3.0.0), which the maintainers decide, not the person cutting the release. | Removing a menu action. Changing insertion output shape so existing documents look different. Dropping a preference with no successor. |
| Adds a capability, or changes behaviour in a way a migration handles for existing users. **Any new preference key is in this row.** | Name the migration and what an upgrading user will notice, in bold, before the details. | The linker review dialog. Source-emphasis preservation. Colour and highlight controls. |
| Fixes something without changing a preference, the output shape or a user-visible default | List the fix. | The apostrophe search fix. The htmlToPlainText ordering fix. |

When in doubt, say more. A loud CHANGELOG entry costs nothing; a quiet one
hides a behaviour change from the person deciding whether to upgrade.

## 2. The coupling that actually matters

> **A new preference key requires: a default, a migration, a `PREFS_SCHEMA_CURRENT_`
> bump, a matching `prefsSchemaVersion` in `VERSION.json`, and a release (the
> next build) whose CHANGELOG entry names the migration. The first four in one
> commit; the build number moves at release (§4).**

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

Listed in `VERSION.json`, and checked by the manifest test:

- **`surfaces`**, what users see: Help → About (`Version 2.0.1`, and the
  *New in 2.0.1* heading) and the release notes (`Version 2.0.1`).
- **`docs`**, everything else that names the current version: the version
  under demo or test in the walkthroughs (with the schema, which the test
  checks too), the current live test checklist they point to, and the release
  commands in the developer walkthrough and the store listing.

Every listed copy carries the build: on the 2.0 line it is the only number that
moves, so a copy without it would read "2.0" for every release.

Do not write the version anywhere else without listing it at the same time. An
unlisted copy is one the test cannot protect, and it will drift. Dated records
(a CHANGELOG heading, a past release's checklist, a design doc's target) are
not listed: they keep the number they were written for. `CLAUDE.md` /
`AGENTS.md` (*Versions: keep them in sync*) has the whole table and the grep
that finds stragglers.

## 4. Releasing

1. The number is the next build (§1): after 2.0.1, 2.0.2.
2. Update `docs/VERSION.json`: `version`, `previous`, `status: "released"`,
   `released` (ISO date), and `prefsSchemaVersion` if a migration shipped.
3. Update every entry in `surfaces` and `docs`, and write
   `docs/live-test-checklist-<version>.md` for the release.
4. Consolidate the `## Unreleased — …` sections in `docs/CHANGELOG.md` under one
   `## vX.Y.Z — <summary> (YYYY-MM-DD)` heading. Keep the sub-headings (Added /
   Fixed / Changed / Security); they are what a reader scans.
5. `npm ci && npm test` — expect **0 failing and 0 skipped**. A non-zero skipped
   count means `npm ci` did not run and the sanitizer assertions sat out.
6. `bash pre_clasp_qc.sh apps-script` — exit 0.
7. Work `docs/marketplace-listing.md` if scopes or data handling changed.
8. Tag the commit `v<version>`. The tag is the only durable record that a given
   commit is what a given user is running.

### Which commit is a test deployment running?

Nothing in the add-on can tell you. *About* shows the `Version` from
`help-modal.html`, which changes only at a release, so every commit between two
releases shows the same number; its GitHub link is a fixed URL, not where the
build came from; and the name in the Extensions menu of a **test deployment**
is the Apps Script project's title, set in the editor, not anything in this
repository (a Marketplace install shows the listing's name). Two documents can
show the same menu name and run different code.

To match a test deployment to a commit, read its code, not its labels. With
the project's script ID (Apps Script editor → Project Settings):

```bash
mkdir /tmp/deployed && cd /tmp/deployed
printf '{"scriptId":"<script id>","fileExtension":"gs"}' > .clasp.json   # .gs, as here
npx --prefix <repo>/tools/clasp clasp pull
git -C <repo> diff --no-index --stat <repo>/apps-script /tmp/deployed
```

No output means the project's HEAD is exactly `apps-script/` at the commit
checked out in `<repo>`; try candidate commits until one is clean. A test
deployment runs HEAD unless it was set to a numbered version (Deploy → Test
deployments shows which). Record the script ID, HEAD or version number, and
the matching commit for each test document before reporting a live result as
a test of a fix.

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
  branch" is not checkable later; "2.0.1, schema 30" is.
