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

// The release line. Every release is the next 2.0.X build until the owner
// explicitly asks to start 2.1 (docs/versioning.md §1). Moving the line is a
// deliberate decision, so it means changing this constant, in the same commit.
const VERSION_LINE = '2.0';

test('version is a well-formed semver with a known status', () => {
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, `bad version: ${manifest.version}`);
  assert.match(manifest.previous, /^\d+\.\d+\.\d+$/, `bad previous: ${manifest.previous}`);
  assert.ok(
    ['released', 'pending-release'].includes(manifest.status),
    `unknown status: ${manifest.status}`
  );
});

test('the version is a build on the current release line', () => {
  assert.ok(
    manifest.version.startsWith(`${VERSION_LINE}.`),
    `${manifest.version} is not a ${VERSION_LINE}.X build. Releases stay on ` +
    `${VERSION_LINE} until the owner asks for the next line (docs/versioning.md §1).`
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

// The docs that name the version: the version under demo or test, the release
// commands and the live test checklist they point to (CLAUDE.md / AGENTS.md:
// "Versions: keep them in sync"). Each carries the full version or, marked
// `line`, the release line as Help → About shows it; and the current schema
// where it names one.
test('every declared doc names the manifest version', () => {
  assert.ok(Array.isArray(manifest.docs) && manifest.docs.length, 'no docs declared');

  const [major, minor] = manifest.version.split('.');
  const majorMinor = `${major}.${minor}`;

  manifest.docs.forEach((doc) => {
    assert.ok(!doc.file.startsWith('apps-script/'), `${doc.file} is user-facing: list it under surfaces`);
    const contents = fs.readFileSync(path.join(ROOT, doc.file), 'utf8');

    assert.ok(
      contents.includes(doc.shows),
      `${doc.file} does not contain "${doc.shows}". ` +
      'Bumping the version means updating every doc listed in VERSION.json.'
    );
    // Not part of a longer number: 2.0.0 is in "v2.0.0" and
    // "checklist-2.0.0.md", not in "2.0.00" or "12.0.0"; a line is "2.0", not "2.0.0".
    const expected = doc.line ? majorMinor : manifest.version;
    assert.ok(
      new RegExp(`(?<![0-9.])${expected.replace(/\./g, '\\.')}(?!\\.?[0-9])`).test(doc.shows),
      `VERSION.json says ${doc.file} shows "${doc.shows}", which does not carry ` +
      `${doc.line ? 'the current line' : 'the current version'} ${expected}.`
    );
    const schema = doc.shows.match(/\bschema (\d+)/);
    assert.ok(
      !schema || schema[1] === manifest.prefsSchemaVersion,
      `${doc.file} names schema ${schema && schema[1]}, but prefsSchemaVersion is ` +
      `${manifest.prefsSchemaVersion}.`
    );
  });
});

test('a released version has a date and a changelog heading', () => {
  const changelog = fs.readFileSync(path.join(ROOT, 'docs/CHANGELOG.md'), 'utf8');
  const heading = changelog.split('\n').find((line) => line.startsWith(`## v${manifest.version} `));

  if (manifest.status !== 'released') {
    // Still in flight: no date yet. A heading for it, if there is one, says so.
    assert.equal(manifest.released, null, 'pending-release must not carry a release date');
    if (heading) {
      assert.ok(
        heading.endsWith('(release pending)'),
        `"${heading}" is for an unreleased version, so it must end "(release pending)"`
      );
    }
    return;
  }

  assert.match(manifest.released, /^\d{4}-\d{2}-\d{2}$/, `bad release date: ${manifest.released}`);
  assert.ok(heading, `docs/CHANGELOG.md has no "## v${manifest.version}" heading for a released version`);
  assert.ok(
    heading.endsWith(`(${manifest.released})`),
    `"${heading}" should end with the release date (${manifest.released})`
  );
});
