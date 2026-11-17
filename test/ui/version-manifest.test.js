// Pins docs/VERSION.json against everything it claims to be the source of truth
// for. Apps Script has no version field of its own — `appsscript.json` carries
// none and `clasp push` overwrites the head deployment in place — so the version
// is a fact this repository asserts rather than one the platform records. A
// claim nothing checks is a claim that drifts.
//
// The assertion that matters most is prefsSchemaVersion. That number gates
// whether an existing user's stored preferences get migrated; shipping a
// preference key without bumping it means the migration never runs for anyone
// already installed. That is the divine-name regression in
// docs/regression-log.md, which this project has already paid for once.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { ROOT, readAppScriptFile } = require('./test-utils');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/VERSION.json'), 'utf8'));

test('version is a well-formed semver with a known status', () => {
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, `bad version: ${manifest.version}`);
  assert.match(manifest.previous, /^\d+\.\d+\.\d+$/, `bad previous: ${manifest.previous}`);
  assert.ok(
    ['released', 'pending-release'].includes(manifest.status),
    `unknown status: ${manifest.status}`
  );
});

test('the version moved forward from the previous one', () => {
  const parse = (v) => v.split('.').map(Number);
  const [aMaj, aMin, aPat] = parse(manifest.version);
  const [bMaj, bMin, bPat] = parse(manifest.previous);

  const ahead =
    aMaj > bMaj ||
    (aMaj === bMaj && aMin > bMin) ||
    (aMaj === bMaj && aMin === bMin && aPat > bPat);

  assert.ok(ahead, `${manifest.version} is not ahead of ${manifest.previous}`);
});

test('prefsSchemaVersion matches PREFS_SCHEMA_CURRENT_ in migrations.gs', () => {
  const migrations = readAppScriptFile('migrations.gs');
  const match = migrations.match(/var PREFS_SCHEMA_CURRENT_ = '(\d+)';/);
  assert.ok(match, 'could not find PREFS_SCHEMA_CURRENT_ in migrations.gs');

  assert.equal(
    manifest.prefsSchemaVersion,
    match[1],
    'VERSION.json and migrations.gs disagree about the preference schema version. ' +
    'Either a migration landed without updating the manifest, or the manifest was ' +
    'bumped without a migration — the second leaves upgrading users in a state no ' +
    'migration covers.'
  );
});

test('every migration up to the current schema version exists', () => {
  const migrations = readAppScriptFile('migrations.gs');
  const current = Number(manifest.prefsSchemaVersion);

  // v1 is the implicit starting state, so migrations run from v2 upward.
  for (let version = 2; version <= current; version++) {
    assert.ok(
      migrations.includes(`function migrateToV${version}_(`),
      `migrateToV${version}_ is missing, but the schema claims to be at ${current}`
    );
    assert.ok(
      new RegExp(`from < ${version}\\b`).test(migrations),
      `migrateToV${version}_ exists but the driver never calls it for from < ${version}`
    );
  }
});

// Each listed copy is in its file, carries the full version (build included),
// and, where it names the preference schema, the current one. The add-on is on
// the 2.0 line, where every release bumps only the build (docs/versioning.md
// §1), so a copy showing MAJOR.MINOR would read "2.0" for every release.
function assertNamesManifestVersion(entry, contents, listName) {
  assert.ok(
    contents.includes(entry.shows),
    `${entry.file} does not contain "${entry.shows}". ` +
    `Bumping the version means updating every entry in VERSION.json's ${listName}.`
  );
  assert.ok(
    // Not part of a longer number: 2.0.1 is in "v2.0.1" and "checklist-2.0.1.md",
    // not in "2.0.10" or "12.0.1".
    new RegExp(`(?<![0-9.])${manifest.version.replace(/\./g, '\\.')}(?!\\.?[0-9])`).test(entry.shows),
    `VERSION.json says ${entry.file} shows "${entry.shows}", which does not ` +
    `carry the current version ${manifest.version}.`
  );
  const schema = entry.shows.match(/\bschema (\d+)/);
  assert.ok(
    !schema || schema[1] === manifest.prefsSchemaVersion,
    `${entry.file} names schema ${schema && schema[1]}, but prefsSchemaVersion is ` +
    `${manifest.prefsSchemaVersion}.`
  );
}

test('every declared surface shows the manifest version', () => {
  assert.ok(Array.isArray(manifest.surfaces) && manifest.surfaces.length, 'no surfaces declared');

  manifest.surfaces.forEach((surface) => {
    const relative = surface.file.replace(/^apps-script\//, '');
    assertNamesManifestVersion(surface, readAppScriptFile(relative), 'surfaces');
  });
});

// The docs that name the version under demo or test, and the release steps
// (CLAUDE.md / AGENTS.md: "Versions: keep them in sync").
test('every declared doc names the manifest version', () => {
  assert.ok(Array.isArray(manifest.docs) && manifest.docs.length, 'no docs declared');

  manifest.docs.forEach((doc) => {
    assert.ok(!/^apps-script\//.test(doc.file), `${doc.file} is user-facing: list it under surfaces`);
    const contents = fs.readFileSync(path.join(ROOT, doc.file), 'utf8');
    assertNamesManifestVersion(doc, contents, 'docs');
  });
});

test('a released version has a date and a changelog heading', () => {
  if (manifest.status !== 'released') {
    // Still in flight: entries live under "Unreleased" headings until release.
    assert.equal(manifest.released, null, 'pending-release must not carry a release date');
    return;
  }

  assert.match(manifest.released, /^\d{4}-\d{2}-\d{2}$/, `bad release date: ${manifest.released}`);

  const changelog = fs.readFileSync(path.join(ROOT, 'docs/CHANGELOG.md'), 'utf8');
  assert.ok(
    changelog.includes(`## v${manifest.version}`),
    `docs/CHANGELOG.md has no "## v${manifest.version}" heading for a released version`
  );
});
