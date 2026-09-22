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
