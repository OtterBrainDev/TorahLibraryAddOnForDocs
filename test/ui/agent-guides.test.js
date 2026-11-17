// CLAUDE.md and AGENTS.md are one agent guide, kept twice so that agents that
// read either file get it. They drifted once: AGENTS.md still expected 248
// passing tests and lacked rules CLAUDE.md had, so an agent reading it worked
// from rules months out of date. Edit one and copy it over the other.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { ROOT } = require('./test-utils');

test('AGENTS.md and CLAUDE.md are identical', () => {
  const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
  const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  assert.ok(
    claude === agents,
    'AGENTS.md and CLAUDE.md differ. They are the same guide: make the change in ' +
    'one and copy it over the other (cp CLAUDE.md AGENTS.md) in the same commit.'
  );
});
