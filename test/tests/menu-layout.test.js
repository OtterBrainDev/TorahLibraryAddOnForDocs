const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The customizable add-on menu (Preferences → Menu Bar). menu-layout.gs is
// pure, so it loads on its own; buildAndInstallMenu only feeds the plan to
// DocumentApp.

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../apps-script/server/menu-layout.gs'),
  'utf8'
);

function load() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: 'menu-layout.gs' });
  return context;
}

// A plan rendered as the menu reads: "Label", "---", { Sub: [ ... ] }.
// Round-tripped through JSON so the result is a plain object of this realm
// (deepStrictEqual rejects arrays created inside the vm context).
function describe(entries) {
  return JSON.parse(JSON.stringify(describeEntries(entries)));
}

function describeEntries(entries) {
  return entries.map((e) => {
    if (e.type === 'separator') return '---';
    if (e.type === 'submenu') return { [e.label]: describeEntries(e.entries) };
    return e.label;
  });
}

const FIXED_TAIL = ['---', 'Preferences', 'Help & Support'];

test('default layout reproduces the menu that shipped before it was customizable', () => {
  const ctx = load();
  const plan = describe(ctx.planMenuFromLayout_(ctx.getDefaultMenuLayout_(), { surpriseMeEnabled: true }));
  assert.deepEqual(plan, [
    'Texts', 'Voices', 'Lexicon', 'Insert Source from Selection',
    { 'Quick Actions': [
      'Quick Actions Sidebar', '---',
      'Transform Divine Names', 'Link Texts with Sefaria', 'Unlink Sources', '---',
      'Gematriya Count',
    ] },
    '---', 'Surprise Me',
    ...FIXED_TAIL,
  ]);
});

test('Surprise Me switched off leaves no stray divider', () => {
  const ctx = load();
  const plan = describe(ctx.planMenuFromLayout_(ctx.getDefaultMenuLayout_(), { surpriseMeEnabled: false }));
  assert.equal(typeof plan[plan.length - 4], 'object', 'the submenu sits right above the fixed tail');
  assert.deepEqual(plan.slice(-3), FIXED_TAIL);
});

test('Preferences and Help are always last, whatever is stored', () => {
  const ctx = load();
  const inputs = [
    '',
    'not json',
    JSON.stringify({ top: [], quick_actions: [] }),
    JSON.stringify({ top: ['preferences', 'help', '-', '-'], quick_actions: ['-'] }),
  ];
  for (const raw of inputs) {
    const plan = describe(ctx.planMenuFromLayout_(raw, { surpriseMeEnabled: false }));
    assert.deepEqual(plan.slice(-3), FIXED_TAIL, raw);
    assert.equal(plan.filter((l) => l === 'Preferences').length, 1, raw);
    assert.equal(plan.filter((l) => l === 'Help & Support').length, 1, raw);
  }
});

test('custom order and nesting are honoured', () => {
  const ctx = load();
  const layout = {
    top: ['insert_from_selection', 'gematriya_count', '-', 'texts', 'quick_actions'],
    quick_actions: ['voices', 'lexicon'],
  };
  const plan = describe(ctx.planMenuFromLayout_(layout, { surpriseMeEnabled: false }));
  assert.deepEqual(plan.slice(0, 4), ['Insert Source from Selection', 'Gematriya Count', '---', 'Texts']);
  // Items the layout did not mention are appended to their default list.
  assert.deepEqual(plan[4]['Quick Actions'].slice(0, 2), ['Voices', 'Lexicon']);
});

test('normalization drops unknown and duplicate ids and restores missing items', () => {
  const ctx = load();
  const layout = ctx.normalizeMenuLayout_({
    top: ['texts', 'texts', 'bogus', 'quick_actions'],
    quick_actions: ['texts', 'quick_actions', 'lexicon'],
  });
  const all = layout.top.concat(layout.quick_actions).filter((id) => id !== '-');
  assert.equal(new Set(all).size, all.length, 'no duplicates');
  assert.ok(!all.includes('bogus'));
  assert.ok(!layout.quick_actions.includes('quick_actions'), 'submenu cannot nest in itself');
  assert.ok(layout.quick_actions.includes('lexicon'));
  // Missing items land in their default list.
  assert.ok(layout.top.includes('voices'));
  assert.ok(layout.quick_actions.includes('transform_divine_names'));
});

test('submenu placeholder comes back when the submenu has items but the placeholder was lost', () => {
  const ctx = load();
  const layout = ctx.normalizeMenuLayout_({ top: ['texts'], quick_actions: ['voices'] });
  assert.ok(layout.top.includes('quick_actions'));
});

test('an emptied submenu is left out of the menu', () => {
  const ctx = load();
  const d = ctx.getDefaultMenuLayout_();
  const layout = {
    top: d.top.concat(d.quick_actions.filter((id) => id !== '-')),
    quick_actions: ['-'],
  };
  const plan = ctx.planMenuFromLayout_(layout, { surpriseMeEnabled: false });
  assert.ok(!plan.some((e) => e.type === 'submenu'));
});

test('no two dividers are ever adjacent, and none leads a list', () => {
  const ctx = load();
  const layout = { top: ['-', '-', 'texts', '-', '-', 'quick_actions', '-'], quick_actions: ['-', 'voices', '-', '-'] };
  const check = (entries) => {
    assert.notEqual(entries[0].type, 'separator');
    assert.notEqual(entries[entries.length - 1].type, 'separator');
    entries.forEach((e, i) => {
      if (i && e.type === 'separator') assert.notEqual(entries[i - 1].type, 'separator');
      if (e.type === 'submenu') check(e.entries);
    });
  };
  check(ctx.planMenuFromLayout_(layout, { surpriseMeEnabled: false }));
});

test('every menu item points at a function the server defines', () => {
  const ctx = load();
  const serverDir = path.resolve(__dirname, '../../apps-script');
  const gsSources = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.gs')) gsSources.push(fs.readFileSync(full, 'utf8'));
    }
  };
  walk(serverDir);
  const all = gsSources.join('\n');
  const plan = ctx.planMenuFromLayout_(ctx.getDefaultMenuLayout_(), { surpriseMeEnabled: true });
  const fns = [];
  const collect = (entries) => entries.forEach((e) => {
    if (e.type === 'item') fns.push(e.fn);
    if (e.type === 'submenu') collect(e.entries);
  });
  collect(plan);
  for (const fn of fns) {
    assert.match(all, new RegExp(`function ${fn}\\s*\\(`), `${fn} is not defined in apps-script/`);
  }
});

test('hidden items keep their place in the layout but are left out of the menu', () => {
  const ctx = load();
  const d = ctx.getDefaultMenuLayout_();
  const layout = { top: d.top, quick_actions: d.quick_actions, hidden: ['lexicon', 'link_texts', 'bogus', 'lexicon'] };
  const normalized = JSON.parse(JSON.stringify(ctx.normalizeMenuLayout_(layout)));
  assert.deepEqual(normalized.hidden, ['lexicon', 'link_texts'], 'unknown and duplicate ids dropped');
  assert.ok(normalized.top.includes('lexicon'), 'a hidden item is not moved or dropped');

  const plan = describe(ctx.planMenuFromLayout_(layout, { surpriseMeEnabled: false }));
  assert.ok(!plan.includes('Lexicon'));
  assert.ok(!plan[3]['Quick Actions'].includes('Link Texts with Sefaria'));
  assert.ok(plan.includes('Voices'));
});

test('hiding the submenu placeholder hides the whole Quick Actions submenu', () => {
  const ctx = load();
  const d = ctx.getDefaultMenuLayout_();
  const plan = ctx.planMenuFromLayout_({ top: d.top, quick_actions: d.quick_actions, hidden: ['quick_actions'] }, { surpriseMeEnabled: false });
  assert.ok(!plan.some((e) => e.type === 'submenu'));
});

test('a layout without "hidden" hides nothing', () => {
  const ctx = load();
  const normalized = ctx.normalizeMenuLayout_(ctx.getDefaultMenuLayoutJson_());
  assert.equal(normalized.hidden.length, 0);
});

// Preferences → Menu Bar moves an item between the menu and the Quick Actions
// submenu with a button that says where it goes ("Move to Quick Actions ▸",
// "◂ Move to main menu"); a bare arrow beside ↑ and ↓ went unnoticed. The
// move itself is menuLayoutMove (preferences/js.html), run here against the
// plan the real menu is built from.
const PREFS_JS = fs.readFileSync(path.resolve(__dirname, '../../apps-script/preferences/js.html'), 'utf8');

function loadMenuLayoutMove() {
  const source = PREFS_JS.match(/function menuLayoutMove\(state, listName, index\) \{[\s\S]*?\n    \}/);
  assert.ok(source, 'preferences/js.html defines menuLayoutMove');
  const context = { MENU_SUBMENU_ID: 'quick_actions' };
  vm.createContext(context);
  vm.runInContext(source[0], context);
  return context.menuLayoutMove;
}

function editorState(layout) {
  return JSON.parse(JSON.stringify(Object.assign({ hidden: [] }, layout)));
}

test('an item moved out of Quick Actions lands just below it in the main menu', () => {
  const ctx = load();
  const move = loadMenuLayoutMove();
  const state = editorState(ctx.getDefaultMenuLayout_());
  const where = move(state, 'quick_actions', state.quick_actions.indexOf('link_texts'));
  assert.deepEqual(JSON.parse(JSON.stringify(where)), { list: 'top', index: state.top.indexOf('quick_actions') + 1 });
  const plan = describe(ctx.planMenuFromLayout_(state, { surpriseMeEnabled: true }));
  assert.deepEqual(plan, [
    'Texts', 'Voices', 'Lexicon', 'Insert Source from Selection',
    { 'Quick Actions': ['Quick Actions Sidebar', '---', 'Transform Divine Names', 'Unlink Sources', '---', 'Gematriya Count'] },
    'Link Texts with Sefaria',
    '---', 'Surprise Me',
    ...FIXED_TAIL,
  ]);
});

test('an item moved into Quick Actions goes to its end, and back out again', () => {
  const ctx = load();
  const move = loadMenuLayoutMove();
  const state = editorState(ctx.getDefaultMenuLayout_());
  const into = move(state, 'top', state.top.indexOf('lexicon'));
  assert.equal(into.list, 'quick_actions');
  assert.equal(state.quick_actions[state.quick_actions.length - 1], 'lexicon');
  assert.ok(!state.top.includes('lexicon'));
  const plan = describe(ctx.planMenuFromLayout_(state, { surpriseMeEnabled: true }));
  assert.deepEqual(plan[3], { 'Quick Actions': ['Quick Actions Sidebar', '---', 'Transform Divine Names', 'Link Texts with Sefaria', 'Unlink Sources', '---', 'Gematriya Count', 'Lexicon'] });
  // And back: below Quick Actions, never lost.
  move(state, 'quick_actions', state.quick_actions.indexOf('lexicon'));
  assert.equal(state.top[state.top.indexOf('quick_actions') + 1], 'lexicon');
  assert.ok(!state.quick_actions.includes('lexicon'));
});

test('moving an item into an emptied or hidden Quick Actions brings the submenu back', () => {
  const ctx = load();
  const move = loadMenuLayoutMove();
  const state = editorState({ top: ['texts', 'voices'], quick_actions: [], hidden: ['quick_actions'] });
  move(state, 'top', 1);
  assert.deepEqual(state.top, ['texts', 'quick_actions']);
  assert.deepEqual(state.hidden, []);
  const plan = describe(ctx.planMenuFromLayout_(state, { surpriseMeEnabled: false }));
  assert.equal(plan[0], 'Texts');
  assert.equal(plan[1]['Quick Actions'][0], 'Voices', 'the moved item is in the submenu, and the submenu is shown');
});

test('the move buttons say where they go', () => {
  assert.match(PREFS_JS, /menuLayoutButton\('Move to ' \+ menuEditorConfig\.submenuLabel \+ ' ▸'/);
  assert.match(PREFS_JS, /menuLayoutButton\('◂ Move to main menu'/);
  assert.match(PREFS_JS, /focus = menuLayoutMove\(menuLayoutState, listName, index\);/);
});
