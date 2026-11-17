# Versioning

For agents (human or AI) changing this add-on. It is short on purpose; the
whole policy is one numbering rule, one coupling that matters more than the
rest, and a release procedure.

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

So when you cut a build, describe the Apps Script version with the add-on
version — `clasp version "v2.0.1"` — so the two can be matched later.

So the version is a fact the repository asserts and keeps consistent, rather
than one the platform records. That is fragile by construction, which is why it
is tested.

---

## 1. The numbering rule: 2.0.X builds

**Every build is the next 2.0.X.** 2.0.0 is the first Marketplace release; the
builds after it are 2.0.1, 2.0.2, 2.0.3 and so on, whatever they contain: a
fix, a new feature, a new preference key, a changed default.

A **build** is a numbered Apps Script version (`clasp version`) handed to
people: the version the Marketplace SDK points users at, or a frozen version
given to testers. Pushes to HEAD, which test deployments run by default, are
not builds and take no number of their own.

**The line moves to 2.1 only when the owner asks for it**, in so many words
("start 2.1"). Then the builds are 2.1.0, 2.1.1, … under the same rule. The
size or kind of a change never moves the line by itself, and neither does
anything else in this file; MAJOR likewise moves only on the owner's request.
If you think a change deserves a new line, say so in your summary; don't move
it.

The test pins the line: `VERSION_LINE` in `test/ui/version-manifest.test.js`
is `'2.0'`. Starting 2.1 means changing that constant, `VERSION.json` and the
surfaces in §3 in one commit.

Because the number no longer says how big a change is, the CHANGELOG has to.
A build's entry says in its first sentence when it changes a default or
behaviour a user relied on, and every preference migration in it has a
*Migration* note saying what existing users get.

Development builds before 2.0.0 carried other numbers (the last was 2.1.0).
They were never published, and those numbers are retired.

## 2. The coupling that actually matters

> **A new preference key requires: a default, a migration, a `PREFS_SCHEMA_CURRENT_`
> bump, and a matching `prefsSchemaVersion` in `VERSION.json`. All four, in one
> commit.** The build that ships it takes the next 2.0.X, like any other build.

This is AGENTS.md hard rule #1 with the schema attached. The reason is
user-data, not bookkeeping: `PREFS_SCHEMA_CURRENT_` is what decides whether an
existing user's stored preferences get migrated. Ship a key without bumping it
and the migration never runs for anyone already installed — which is exactly the
divine-name regression in `docs/regression-log.md`, the one this project has
already paid for once.

The schema version **only ever increases**, and is never reused or rolled back.
A user who has run schema 9 cannot be moved back to 8; the migration driver
compares numerically (`from < N`) and would simply skip everything. Resetting
the add-on's version to 2.0.0 did **not** reset the schema (it stayed at 30),
and a change of line never does.

## 3. Where the version appears

Listed in `VERSION.json` under `surfaces`, and checked by the manifest test:

- `apps-script/help-modal.html` — About tab, `Current line: 2.0`
- `apps-script/release-notes.html` — `Version 2.0`, shown on install

Both show MAJOR.MINOR only, so a 2.0.X build doesn't change them. A build that
changes something a user will notice adds a line to the release notes under
*Version 2.0*.

Do not add a third surface without adding it to `surfaces` at the same time. An
unlisted copy is one the test cannot protect, and it will drift.

Docs that name the version are listed under `docs` and checked the same way:
the version under demo or test in the walkthroughs, the live test checklist
they and the store listing point to, and the release commands. Each carries
the full version (`2.0.0, schema 30`, `v2.0.0`), or, marked `line`, the line
as About shows it (`Current line: 2.0`); a schema it names must be the current
one. A dated record (a CHANGELOG heading, a past build's live test checklist, a
design doc's target) is not listed: it keeps the number it was written for.
`CLAUDE.md` / `AGENTS.md` (*Versions: keep them in sync*) has the whole table
and the grep that finds stragglers.

## 4. Releasing

1. Take the next 2.0.X (§1). `previous` is the version it replaces.
2. Update `docs/VERSION.json`: `version`, `previous`, `status: "released"`,
   `released` (ISO date), and `prefsSchemaVersion` if a migration shipped.
3. Check the surfaces (§3): on the 2.0 line they stay as they are; add release
   notes for anything a user will notice. Update every entry in `docs` (§3);
   they then point at `docs/live-test-checklist-2.0.X.md`, so write it.
4. Rename `## Unreleased` in `docs/CHANGELOG.md` to
   `## v2.0.X — <summary> (YYYY-MM-DD)`, with the same date as `released`.
   Keep the sub-headings (Added / Fixed / Changed / Security); they are what a
   reader scans.
5. `npm ci && npm test` — expect **0 failing and 0 skipped**. A non-zero skipped
   count means `npm ci` did not run and the sanitizer assertions sat out.
6. `bash pre_clasp_qc.sh apps-script` — exit 0.
7. Work `docs/marketplace-listing.md` if scopes or data handling changed.
8. Tag the commit `v2.0.X`, and freeze the build with the same text:
   `clasp version "v2.0.X"`. The tag is the only durable record that a given
   commit is what a given user is running.

**Numbered but not yet published.** Between choosing the number and the day
it goes out, `VERSION.json` may say `status: "pending-release"` with
`released: null`, and the CHANGELOG heading ends `(release pending)` instead of
a date. The test accepts that state. On release day, set the status and the
date, and put the same date in the heading. 2.0.0 is in this state until it is
published.

### Which commit is a test deployment running?

Nothing in the add-on can tell you. *About* shows `Current line` from
`help-modal.html`, which changes only when the line does, so every build on a
line shows the same number; its GitHub link is a fixed URL, not where the
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
- **Never move the line.** 2.0 → 2.1 (or a new MAJOR) happens only when the
  owner asks for it specifically. A new feature, a new preference key or a
  changed default is not a reason; a 2.0.X build covers all of them.
- **Never edit `PREFS_SCHEMA_CURRENT_` without writing the migration.** The
  number is not a label; it gates whether existing users' data gets touched.
- **Never hand-edit a file under `test/ui/snapshots/`.** Regenerate with
  `UPDATE_UI_SNAPSHOTS=1 npm test` and read the resulting diff. A snapshot
  edited by hand has already lost the property it exists to guarantee — this has
  happened here before, and left the suite red on a branch.
- **If a change will need a release and you were not asked for one**, say so in
  your summary rather than doing it silently. The person releasing needs to know
  what the next 2.0.X carries.
- **State the version you tested against** when reporting results. "Works on my
  branch" is not checkable later; "2.0.0, schema 30" is.
