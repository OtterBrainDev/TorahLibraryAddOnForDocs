// Pins Surprise Me to one form: the sidebar's Experimental section and the
// Surprise Me dialog (Quick Actions 🎲, the menu) both include
// shared/surprise-me. They had drifted: the sidebar asked for a "topic hint"
// and 1–10 sources (3 by default) from five fixed corpuses, the dialog for a
// search term and 5 sources from the corpuses you tick; and the sidebar read
// `result.success` and `result.seedWord`, which the server never sends, so it
// reported the count asked for rather than what was inserted.

const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const SIDEBAR = readAppScriptFile('sidebar.html');
const DIALOG = readAppScriptFile('surprise-me.html');
const DIALOG_JS = readAppScriptFile('surprise-me/js.html');
const SHARED_JS = readAppScriptFile('shared/surprise-me/js.html');
const SHARED_MARKUP = readAppScriptFile('shared/surprise-me/markup.html');
const SERVER = readAppScriptFile('surprise-me-feature.gs');
const SIDEBAR_JS = ['sidebar/js/event-bindings.html', 'sidebar/js/mode-controller.html'].map(readAppScriptFile).join('\n');

const count = (text, needle) => text.split(needle).length - 1;

test('the sidebar and the dialog include the one Surprise Me form, and have none of their own', () => {
  [['sidebar.html', SIDEBAR], ['surprise-me.html', DIALOG]].forEach(([name, page]) => {
    assert.equal(count(page, "<?!= include('shared/surprise-me/markup') ?>"), 1, `${name} includes the form once`);
    assert.equal(count(page, "include('shared/surprise-me/css')"), 1, `${name} includes its styles`);
    assert.equal(count(page, "include('shared/surprise-me/js')"), 1, `${name} includes its script`);
    assert.doesNotMatch(page, /id="surprise-(term|count|submit|status)"|sm-inline|corpus-grid/, `${name} has a Surprise Me field of its own`);
  });
  assert.doesNotMatch(SIDEBAR_JS, /sm-inline|sm-count|expSetBusy|expSetStatus/, 'the old sidebar form\'s handlers are gone');
});

test('both start the same controller; only the dialog has Cancel', () => {
  assert.match(SIDEBAR_JS, /initSurpriseMeForm\(\);/);
  assert.match(DIALOG_JS, /initSurpriseMeForm\(\{\s*onCancel: function \(\) \{ google\.script\.host\.close\(\); \}/);
  assert.match(SHARED_MARKUP, /id="surprise-cancel" hidden/);
  assert.match(SHARED_JS, /if \(typeof opts\.onCancel === 'function'\) \{\s*cancel\.hidden = false;/);
});

test('the form sends the term, the count and the ticked corpuses, and shows what the server says it inserted', () => {
  assert.match(SHARED_JS, /term: \(term\.value \|\| ''\)\.trim\(\),\s*count: clampCount\(\),\s*corpuses: selectedCorpuses\(\)/);
  assert.match(SHARED_JS, /\.insertSurpriseMe\(payload\)/);
  assert.match(SHARED_JS, /setStatus\(\(result && result\.message\) \|\| 'Done\.', 'success'\)/);
  assert.doesNotMatch(SHARED_JS, /result\.success|seedWord/);
  // The server's answer has that message.
  assert.match(SERVER, /return \{\s*term: term,\s*inserted: inserted,\s*message:/);
  // The fourteen corpuses the dialog has always offered, once each.
  const offered = [...SHARED_MARKUP.matchAll(/<input type="checkbox" value="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(offered.length, 14);
  assert.equal(new Set(offered).size, offered.length);
  assert.doesNotMatch(SHARED_JS, /innerHTML|\.html\(/);
});
