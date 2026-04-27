const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { ROOT, readAppScriptFile } = require('./test-utils');

const SNAPSHOT_DIR = path.join(ROOT, 'test/ui/snapshots');
const TEMPLATES = ['sidebar.html', 'preferences.html', 'surprise-me.html'];
const updateSnapshots = process.env.UPDATE_UI_SNAPSHOTS === '1';

TEMPLATES.forEach((templateFile) => {
  test(`template snapshot: ${templateFile}`, () => {
    const current = readAppScriptFile(templateFile);
    const snapshotPath = path.join(SNAPSHOT_DIR, `${templateFile}.snap`);

    if (updateSnapshots) {
      fs.writeFileSync(snapshotPath, current, 'utf8');
      return;
    }

    assert.ok(fs.existsSync(snapshotPath), `Missing snapshot file: ${snapshotPath}`);

    const snapshot = fs.readFileSync(snapshotPath, 'utf8');
    assert.equal(current, snapshot, `${templateFile} changed from baseline snapshot.`);
  });
});
