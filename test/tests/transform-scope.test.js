// Transform Divine Names confirms and edits the selected body ranges, or the
// active tab's entire body when the reader clears the selection.

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
  const element = {
    getType: () => type,
    getNumChildren: () => children.length,
    getChild: (i) => children[i],
    getChildIndex: (child) => children.indexOf(child),
    getText: () => children.map(child => child.getText()).join('\n'),
  };
  children.forEach(child => { child.getParent = () => element; });
  return element;
}

function range(element, start, end) {
  return {
    getElement: () => element,
    isPartial: () => start !== undefined,
    getStartOffset: () => start,
    getEndOffsetInclusive: () => end,
  };
}

function load({ prefs, answer = 'YES', selection = (text) => [range(text.b)],
  bText = 'B: יהוה God', duringConfirmation } = {}) {
  const b = textElement(bText);
  const c = textElement('C: יהוה');
  const cell = textElement('יְהוָ֥ה');
  const otherTab = textElement('יהוה God');
  const header = textElement('יהוה');
  container('HEADER_SECTION', [header]);
  const table = container('TABLE', [container('TABLE_ROW', [container('TABLE_CELL', [container('PARAGRAPH', [cell])])])]);
  const body = container('BODY_SECTION', [container('PARAGRAPH', [b]), container('PARAGRAPH', [c]), table]);
  const texts = { b, c, cell, otherTab, header };
  let activeTab = 'one';
  const alerts = [];
  const context = {
    console,
    Logger: { log() {} },
    DocumentApp: {
      ElementType: { TEXT: 'TEXT', BODY_SECTION: 'BODY_SECTION' },
      getActiveDocument: () => ({
        getId: () => 'doc',
        getActiveTab: () => ({ getId: () => activeTab }),
        getBody: () => body,
        getSelection: () => (selection ? { getRangeElements: () => selection(texts, table) } : null),
      }),
      getUi: () => ({
        Button: { YES: 'YES', NO: 'NO' },
        ButtonSet: { YES_NO: 'YES_NO' },
        alert: (...args) => {
          alerts.push(args);
          if (args.length === 1) return 'OK';
          if (duringConfirmation) duringConfirmation(texts, () => { activeTab = 'two'; });
          return answer;
        },
      }),
    },
    getPreferences: () => prefs || { meforash_replace: 'true', meforash_replacement: 'יי', god_replace: 'true', god_replacement: 'TEST$&' },
  };
  vm.createContext(context);
  for (const file of ['server/source-text.gs', 'server/text-processing.gs', 'server/document-actions.gs']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', file), 'utf8'), context, { filename: file });
  }
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
  assert.match(message, /matching divine names in the selected text in this tab/);
  assert.match(message, /Headers, footers, footnotes and other tabs stay unchanged/);
  assert.match(message, /\u2066\u2068יי\u2069 {2}← {2}\u2067יהוה\u2069\u2069/);
  assert.match(message, /\u2066God {2}→ {2}\u2068TEST\$&\u2069\u2069/, 'a custom replacement is shown as entered');
  assert.match(message, /Undo/);
});

test('without a selection, the confirmation and count refer to the tab body, including tables', () => {
  const env = load({ selection: false });
  env.context.transformDivineNames();
  assert.match(env.alerts[0][1], /the whole body of this tab/);
  assert.deepEqual(env.now(), { b: 'B: יי TEST$&', c: 'C: יי', cell: 'יְיָ֥', otherTab: 'יהוה God', header: 'יהוה' });
  assert.match(env.alerts[1][0], /Replaced 4 divine names in the whole body of this tab/);
});

test('a partial selection limits each rule, even after another rule changes the length', () => {
  const env = load({
    bText: 'יהוה God / יהוה God / God',
    selection: ({ b }) => [range(b, 11, 18)],
  });
  env.context.transformDivineNames();
  assert.deepEqual(env.now(), { b: 'יהוה God / יי TEST$& / God', c: 'C: יהוה', cell: 'יְהוָ֥ה', otherTab: 'יהוה God', header: 'יהוה' });
  assert.match(env.alerts[1][0], /Replaced 2 divine names in the selected text in this tab/);
});

test('matches that cross a selection boundary stay intact, even if the selection contains a shorter rule', () => {
  const env = load({
    bText: 'יהוה God',
    prefs: { meforash_replace: 'true', yaw_replace: 'true', god_replace: 'true' },
    selection: ({ b }) => [range(b, 0, 1), range(b, 5, 6)],
  });
  const before = env.now();
  env.context.transformDivineNames();
  assert.deepEqual(env.now(), before);
  assert.match(env.alerts[1][0], /No divine names.*in the selected text/);
});

test('selected containers and separate ranges are supported without expanding to the rest of the body', () => {
  const env = load({ selection: ({ b }, table) => [range(b, 3, 6), range(table)] });
  env.context.transformDivineNames();
  assert.equal(env.now().b, 'B: יי God');
  assert.equal(env.now().c, 'C: יהוה');
  assert.equal(env.now().cell, 'יְיָ֥');
});

test('an empty or out-of-body selection never falls back to the whole body', () => {
  for (const selection of [() => [], ({ header }) => [range(header)]]) {
    const env = load({ selection });
    const before = env.now();
    env.context.transformDivineNames();
    assert.deepEqual(env.now(), before);
    assert.match(env.alerts[0][0], /Could not use the selection.*Nothing was changed/);
    assert.equal(env.alerts.length, 1);
  }
});

test('a changed tab or selected text aborts the command after confirmation', () => {
  for (const duringConfirmation of [(_, switchTab) => switchTab(), ({ b }) => b.insertText(0, '*')]) {
    const env = load({ duringConfirmation });
    env.context.transformDivineNames();
    assert.match(env.now().b, /יהוה God$/);
    assert.equal(env.now().c, 'C: יהוה');
    assert.match(env.alerts[1][0], /Could not verify the confirmed scope/);
  }
});

test('nothing to replace says so', () => {
  const env = load({ prefs: { elodim_replace: 'true' } });
  env.context.transformDivineNames();
  assert.match(env.alerts[0][1], /\u2066\u2068אלוקים\u2069 {2}← {2}\u2067אלהים \/ אלוהים\u2069\u2069/);
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
