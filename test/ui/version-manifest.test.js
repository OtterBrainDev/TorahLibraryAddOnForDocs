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

test('every declared surface shows the manifest version', () => {
  assert.ok(Array.isArray(manifest.surfaces) && manifest.surfaces.length, 'no surfaces declared');

  const [major, minor] = manifest.version.split('.');
  const majorMinor = `${major}.${minor}`;

  manifest.surfaces.forEach((surface) => {
    const relative = surface.file.replace(/^apps-script\//, '');
    const contents = readAppScriptFile(relative);

    assert.ok(
      contents.includes(surface.shows),
      `${surface.file} does not contain "${surface.shows}". ` +
      'Bumping the version means updating every surface listed in VERSION.json.'
    );
    assert.ok(
      surface.shows.includes(majorMinor),
      `VERSION.json says ${surface.file} shows "${surface.shows}", which does not ` +
      `carry the current version ${majorMinor}.`
    );
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
