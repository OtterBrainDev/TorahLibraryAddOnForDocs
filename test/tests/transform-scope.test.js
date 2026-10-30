// Pins what Quick Actions → Transform Divine Names changes, and that it says so
// before changing it (BUG-006; server/document-actions.gs transformDivineNames).
//
// Live, 30 October 2026, in an isolated document: with B selected and C not,
// both changed; a second tab did not; no confirmation appeared, and
// Preferences called the command "document-wide". The scope is the body of
// the tab that is open (Document.getBody()), selection or not, without headers,
// footers, footnotes or other tabs. That scope is kept; what changed is that it
// is stated, and the user agrees, before anything is replaced.
//
// Loaded with vm.runInContext; see AGENTS.md hard rule #3.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

function textElement(initial) {
  let content = initial;
  const element = {
    getType: () => 'TEXT',
    asText: () => element,
    getText: () => content,
    getAttributes: () => ({}),
    getLinkUrl: () => null,
    deleteText: (s, e) => { content = content.slice(0, s) + content.slice(e + 1); },
    insertText: (s, str) => { content = content.slice(0, s) + str + content.slice(s); },
    setAttributes() {},
    setLinkUrl() {},
  };
  return element;
}

function container(type, children) {
  return { getType: () => type, getNumChildren: () => children.length, getChild: (i) => children[i] };
}

// The open tab's body: B (selected), C (not), and a table cell. A second tab
// and a header that also contain the Name, which the body does not reach.
function load({ prefs, answer = 'YES', selection = true } = {}) {
  const b = textElement('B: יהוה God');
  const c = textElement('C: יהוה');
  const cell = textElement('יְהוָ֥ה');
  const otherTab = textElement('יהוה God');
  const header = textElement('יהוה');
  const body = container('BODY', [
    container('PARAGRAPH', [b]),
    container('PARAGRAPH', [c]),
    container('TABLE', [container('TABLE_ROW', [container('TABLE_CELL', [container('PARAGRAPH', [cell])])])]),
  ]);
  const alerts = [];
  const context = {
    console,
    Logger: { log() {} },
    DocumentApp: {
      ElementType: { TEXT: 'TEXT' },
      getActiveDocument: () => ({
        getBody: () => body,
        getHeader: () => container('HEADER', [header]),
        getTabs: () => [{ body }, { body: container('BODY', [otherTab]) }],
        getSelection: () => (selection ? { getRangeElements: () => [{ getElement: () => b }] } : null),
      }),
      getUi: () => ({
        Button: { YES: 'YES', NO: 'NO' },
        ButtonSet: { YES_NO: 'YES_NO' },
        alert: (...args) => { alerts.push(args); return args.length > 1 ? answer : 'OK'; },
      }),
    },
    getPreferences: () => prefs || { meforash_replace: 'true', meforash_replacement: 'יי', god_replace: 'true', god_replacement: 'TEST$&' },
  };
  vm.createContext(context);
  for (const file of ['server/text-processing.gs', 'server/document-actions.gs']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', file), 'utf8'), context, { filename: file });
  }
  const texts = { b, c, cell, otherTab, header };
  const now = () => Object.fromEntries(Object.entries(texts).map(([k, t]) => [k, t.getText()]));
  return { context, alerts, now };
}

test('it asks first, naming the scope and the rules, and declining changes nothing', () => {
  const env = load({ answer: 'NO' });
  const before = env.now();
  env.context.transformDivineNames();
  assert.deepEqual(env.now(), before);
  assert.equal(env.alerts.length, 1, 'only the question; no summary after a No');
  const [title, message, buttons] = env.alerts[0];
  assert.equal(title, 'Transform Divine Names');
  assert.equal(buttons, 'YES_NO');
  assert.match(message, /every match in the body of the tab you have open/);
  assert.match(message, /not only selected text/);
  assert.match(message, /Headers, footers, footnotes and other tabs are not changed/);
  assert.match(message, /the selection does not limit what is replaced/);
  assert.match(message, /יהוה {2}→ {2}יי/);
  assert.match(message, /God {2}→ {2}TEST\$&/, 'a custom replacement is shown as entered');
  assert.match(message, /Undo/);
});

test('without a selection it does not talk about one', () => {
  const env = load({ answer: 'NO', selection: false });
  env.context.transformDivineNames();
  assert.doesNotMatch(env.alerts[0][1], /selected:/);
  assert.doesNotMatch(env.alerts[0][1], /selection does not limit/);
});

test('accepted: selected and unselected text in the open tab change alike; other tabs and the header do not', () => {
  const env = load();
  env.context.transformDivineNames();
  const after = env.now();
  assert.equal(after.b, 'B: יי TEST$&');
  assert.equal(after.c, 'C: יי', 'unselected text is changed too: the selection does not limit it');
  assert.equal(after.cell, 'יְיָ֥', 'a table in the body is part of the body');
  assert.equal(after.otherTab, 'יהוה God', 'another tab is untouched');
  assert.equal(after.header, 'יהוה', 'the header is untouched');
  assert.equal(env.alerts.length, 2);
  assert.match(env.alerts[1][0], /Replaced 4 divine names in this tab.s body/);
});

test('nothing to replace says so', () => {
  const env = load({ prefs: { elodim_replace: 'true' } });
  env.context.transformDivineNames();
  assert.match(env.alerts[0][1], /אלהים \/ אלוהים {2}→ {2}אלוקים/);
  assert.match(env.alerts[1][0], /No divine names matching your rules were found/);
});

test('no rules turned on: it says so and asks nothing', () => {
  const env = load({ prefs: {} });
  const before = env.now();
  env.context.transformDivineNames();
  assert.equal(env.alerts.length, 1);
  assert.match(env.alerts[0][0], /No divine-name transforms are enabled/);
  assert.deepEqual(env.now(), before);
});
