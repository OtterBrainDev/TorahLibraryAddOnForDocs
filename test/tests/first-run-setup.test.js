// Pins first-run setup and the Simple / Full interface mode
// (apps-script/server/first-run.gs, apps-script/first-run-setup/js.html,
// docs/first-run-setup-design.md).
//
// The properties that matter:
//   - clicking through setup with the preselected answers writes nothing;
//   - only values the dialog can produce are ever stored;
//   - switching to Simple and back gives the user their own menu back;
//   - the dialog's preview transforms the sample exactly as an insert would.
//
// Loaded with vm against stubs; see AGENTS.md hard rule #3.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const APPS_SCRIPT = path.resolve(__dirname, '../../apps-script');
const read = (rel) => fs.readFileSync(path.join(APPS_SCRIPT, rel), 'utf8');
const MENU_LAYOUT = read('server/menu-layout.gs');
const FIRST_RUN = read('server/first-run.gs');
const PREFERENCES = read('server/preferences.gs');
const TEXT_PROCESSING = read('server/text-processing.gs');
const SETUP_JS = read('first-run-setup/js.html');

function makeUserProperties(initial = {}) {
  const store = Object.assign({}, initial);
  return {
    store,
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setProperty(k, v) { store[k] = String(v); return this; },
    deleteProperty(k) { delete store[k]; return this; },
  };
}

function load(initialProps = {}, extra = {}) {
  const userProperties = makeUserProperties(initialProps);
  const calls = [];
  const context = {
    console,
    Logger: { log() {} },
    PropertiesService: { getUserProperties: () => userProperties },
    HtmlService: {
      createTemplateFromFile: (name) => ({
        evaluate() { calls.push(`template:${name}`); return { setWidth() { return this; }, setHeight() { return this; } }; },
      }),
    },
    DocumentApp: { getUi: () => ({ showModalDialog: (out, title) => calls.push(`dialog:${title}`) }) },
    getUiAppConfig_: (pageId, mode, extraFields) => Object.assign({ pageId, mode }, extraFields),
    toEmbeddedJson_: (value) => JSON.stringify(value),
    runUserPreferenceMigrationsIfNeeded_: () => calls.push('migrate'),
    buildAndInstallMenu: () => calls.push('buildMenu'),
  };
  Object.assign(context, extra);
  vm.createContext(context);
  vm.runInContext(MENU_LAYOUT, context, { filename: 'menu-layout.gs' });
  vm.runInContext(FIRST_RUN, context, { filename: 'first-run.gs' });
  return { context, calls, store: userProperties.store };
}

// What a new user has after seedDefaultPreferences_: every default, as strings.
function seededDefaults() {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(MENU_LAYOUT, context);
  vm.runInContext(PREFERENCES, context);
  const defaults = vm.runInContext('getDefaultPreferences()', context);
  const out = {};
  Object.keys(defaults).forEach((k) => { out[k] = String(defaults[k]); });
  return out;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

// ── Answers and the writes they imply ─────────────────────────────────────

test('a new user\'s preselected answers are the shipped defaults', () => {
  const { context } = load();
  const answers = plain(context.firstRunAnswersFromPreferences_(seededDefaults()));
  assert.equal(answers.show, 'both');
  assert.equal(answers.arrangement, 'he-right');
  assert.equal(answers.vowels, 'always');
  assert.equal(answers.teamim, true);
  assert.deepEqual(answers.divine.meforash, { on: true, text: 'יי' });
  assert.equal(answers.divine.god.on, false);
  assert.equal(answers.language, 'en');
  assert.equal(answers.uiMode, 'full');
});

test('clicking through with the preselected answers writes nothing', () => {
  const { context } = load();
  const prefs = seededDefaults();
  const answers = context.firstRunAnswersFromPreferences_(prefs);
  const plan = plain(context.planFirstRunPreferences_(answers, prefs));
  assert.deepEqual(plan.changes, {});
  assert.equal(plan.uiMode, 'full');
});

test('the same holds for a user whose settings are far from the defaults', () => {
  const { context } = load();
  const prefs = Object.assign(seededDefaults(), {
    output_mode_default: 'he',
    bilingual_layout_default: 'he-left',
    nekudot: 'true',
    nekudot_filter: 'tanakh',
    teamim: 'false',
    apply_sheimot_on_insertion: 'false',
    meforash_replace: 'true',
    god_replace: 'true',
    god_replacement: 'Hashem (custom)',
    preferred_translation_language: 'fr',
    ui_mode: 'simple',
  });
  const answers = context.firstRunAnswersFromPreferences_(prefs);
  assert.deepEqual(plain(context.planFirstRunPreferences_(answers, prefs).changes), {});
});

test('"I\'ve used Torah Library before" sends nothing, so nothing changes', () => {
  const { context } = load();
  const plan = plain(context.planFirstRunPreferences_({}, seededDefaults()));
  assert.deepEqual(plan, { changes: {}, uiMode: null });
});

test('each answer writes the keys the Preferences controls write', () => {
  const { context } = load();
  const prefs = seededDefaults();
  const plan = plain(context.planFirstRunPreferences_({
    show: 'he',
    arrangement: 'he-top',
    vowels: 'never',
    teamim: false,
    divine: { god: { on: true, text: 'HaShem' }, meforash: { on: true, text: "ה'" } },
    language: 'es',
    uiMode: 'simple',
  }, prefs));
  assert.deepEqual(plan.changes, {
    output_mode_default: 'he',
    bilingual_layout_default: 'he-top',
    nekudot: 'false',
    nekudot_filter: 'false',
    teamim: 'false',
    god_replace: 'true',
    god_replacement: 'HaShem',
    meforash_replacement: "ה'",
    preferred_translation_language: 'es',
  });
  assert.equal(plan.uiMode, 'simple');

  const tanakh = plain(context.planFirstRunPreferences_({ vowels: 'tanakh' }, prefs));
  assert.deepEqual(tanakh.changes, { nekudot_filter: 'tanakh' });
});

test('values the dialog cannot produce are dropped, never stored', () => {
  const { context } = load();
  const prefs = seededDefaults();
  const plan = plain(context.planFirstRunPreferences_({
    show: 'everything',
    arrangement: '<script>',
    vowels: 'sometimes',
    teamim: 'yes',
    divine: { meforash: { on: 'true', text: 'x'.repeat(200) }, unknown: { on: true, text: 'a' }, god: { on: true, text: '   ' } },
    language: 'english; drop table',
    uiMode: 'pro',
    prefs_schema_version: '1',
    linker_upload_acknowledged: 'true',
  }, prefs));
  // god.on is a real boolean and differs from the stored value; its empty
  // text keeps the stored replacement.
  assert.deepEqual(plan.changes, { god_replace: 'true' });
  assert.equal(plan.uiMode, null);
});

test('turning a divine name on when substitution is off turns the master switch on too', () => {
  const { context } = load();
  const prefs = Object.assign(seededDefaults(), { apply_sheimot_on_insertion: 'false', meforash_replace: 'true' });
  const answers = plain(context.firstRunAnswersFromPreferences_(prefs));
  assert.equal(answers.divine.meforash.on, false, 'substitution off means the name is shown off');

  const plan = plain(context.planFirstRunPreferences_({ divine: { meforash: { on: true, text: 'יי' } } }, prefs));
  assert.deepEqual(plan.changes, { meforash_replace: 'true', apply_sheimot_on_insertion: 'true' });
});

// ── Interface mode and the menu ───────────────────────────────────────────

test('the Simple menu is Texts, Insert from Selection and two quick actions, then Preferences and Help', () => {
  const { context } = load();
  const plan = plain(context.planMenuFromLayout_(context.getSimpleMenuLayout_(), { surpriseMeEnabled: true }));
  const labels = plan.map((e) => (e.type === 'submenu' ? `${e.label}: ${e.entries.map((c) => c.label).join(', ')}` : e.label || '---'));
  assert.deepEqual(labels, [
    'Texts',
    'Insert Source from Selection',
    'Quick Actions: Transform Divine Names, Link Texts with Sefaria',
    '---',
    'Preferences',
    'Help & Support',
  ]);
});

test('switching to Simple keeps the user\'s own menu aside; switching back restores it', () => {
  const custom = JSON.stringify({ top: ['lexicon', 'texts'], quick_actions: [], hidden: ['voices'] });
  const { context, store } = load({ ui_mode: 'full', menu_layout: custom });

  context.applyUiModeSwitch_('simple');
  assert.equal(store.ui_mode, 'simple');
  assert.equal(store.menu_layout_before_simple, custom);
  assert.equal(store.menu_layout, context.getSimpleMenuLayoutJson_());

  const back = context.applyUiModeSwitch_('full');
  assert.equal(back.menuKept, false);
  assert.equal(store.ui_mode, 'full');
  assert.equal(store.menu_layout, custom);
  assert.equal(store.menu_layout_before_simple, '');
});

test('with no menu of their own, switching back to Full returns to the code default', () => {
  const { context, store } = load({ ui_mode: 'full' });
  context.applyUiModeSwitch_('simple');
  assert.equal(store.menu_layout_before_simple, '');
  context.applyUiModeSwitch_('full');
  assert.ok(!('menu_layout' in store), 'an unset layout tracks the default and picks up new menu items');
});

test('a menu rearranged while in Simple mode is kept when switching back', () => {
  const { context, store } = load({ ui_mode: 'full' });
  context.applyUiModeSwitch_('simple');
  const edited = JSON.stringify({ top: ['texts', 'voices'], quick_actions: [] });
  store.menu_layout = edited;
  const result = context.applyUiModeSwitch_('full');
  assert.equal(result.menuKept, true);
  assert.equal(store.menu_layout, edited);
});

test('switching to the mode you are already in changes nothing', () => {
  const { context, store } = load({ ui_mode: 'simple', menu_layout: 'x' });
  context.applyUiModeSwitch_('simple');
  assert.deepEqual(plain(store), { ui_mode: 'simple', menu_layout: 'x' });
});

test('setUiMode treats anything but "simple" as "full" and rebuilds the menu', () => {
  const { context, store, calls } = load({ ui_mode: 'simple' });
  const result = plain(context.setUiMode('advanced'));
  assert.equal(result.uiMode, 'full');
  assert.equal(store.ui_mode, 'full');
  assert.ok(calls.includes('buildMenu'));
});

// ── Showing setup ─────────────────────────────────────────────────────────

test('setup is shown once while pending, then marked done', () => {
  const { context, calls, store } = load({ first_run_setup: 'pending' });
  assert.equal(context.maybeShowFirstRunSetup_(), true);
  assert.ok(calls.includes('migrate'), 'migrations run before the check');
  assert.ok(calls.includes('dialog:Welcome to Torah Library'));
  assert.equal(store.first_run_setup, 'done');
  assert.equal(context.maybeShowFirstRunSetup_(), false);
});

test('setup is never shown to an upgrader, whose flag is "done" or missing', () => {
  for (const initial of [{ first_run_setup: 'done' }, {}]) {
    const { context, calls } = load(initial);
    assert.equal(context.maybeShowFirstRunSetup_(), false);
    assert.ok(!calls.some((c) => c.startsWith('dialog:')));
  }
});

test('completing setup writes the answers, marks it done and rebuilds the menu', () => {
  const { context, store, calls } = load(Object.assign(seededDefaults(), { first_run_setup: 'pending' }));
  const result = plain(context.completeFirstRunSetup(JSON.stringify({ arrangement: 'he-top', uiMode: 'simple' })));
  assert.equal(result.uiMode, 'simple');
  assert.equal(store.bilingual_layout_default, 'he-top');
  assert.equal(store.ui_mode, 'simple');
  assert.equal(store.menu_layout, context.getSimpleMenuLayoutJson_());
  assert.equal(store.first_run_setup, 'done');
  assert.ok(calls.includes('buildMenu'));
});

test('a malformed answers payload still marks setup done and changes nothing else', () => {
  const before = Object.assign(seededDefaults(), { first_run_setup: 'pending' });
  const { context, store } = load(before);
  context.completeFirstRunSetup('{not json');
  assert.deepEqual(plain(store), Object.assign({}, before, { first_run_setup: 'done' }));
});

// ── The dialog's preview matches what an insert does ──────────────────────

function loadPreview() {
  // Everything before the dialog's IIFE: the sample and the pure helpers.
  const source = SETUP_JS.replace(/^<script>/, '').split('\n(function () {')[0];
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'first-run-setup/js.html' });
  return context;
}

function serverPreview(prefs, sample) {
  const userProperties = makeUserProperties(prefs);
  const context = { console, Logger: { log() {} } };
  vm.createContext(context);
  vm.runInContext(TEXT_PROCESSING, context, { filename: 'text-processing.gs' });
  context.props = userProperties;
  context.sample = sample;
  // The display, Hebrew-name and "God" passes of findReference, in its order.
  // Punctuation is skipped: setup does not ask about it.
  return vm.runInContext(`(() => {
    let data = applyHebrewDisplayPreferences(sample, props);
    data = applyHebrewDivineNamePreferences(data, props);
    applyEnglishDivineNamePreference(data, props);
    return { he: data.he, en: data.text };
  })()`, context);
}

// The dialog always sends all four names; a name it leaves out is off.
function names(on = {}) {
  const off = { meforash: 'יי', elodim: 'אלוקים', yaw: 'קה', god: 'G-d' };
  const out = {};
  Object.keys(off).forEach((id) => { out[id] = on[id] ? { on: true, text: on[id] } : { on: false, text: off[id] }; });
  return out;
}

const PREVIEW_CASES = [
  { vowels: 'always', teamim: true, divine: names() },
  { vowels: 'never', teamim: false, divine: names() },
  { vowels: 'tanakh', teamim: false, divine: names({ meforash: 'יי' }) },
  { vowels: 'never', teamim: true, divine: names({ meforash: "ה'", god: 'HaShem' }) },
  { vowels: 'always', teamim: true, divine: names({ meforash: '$&', yaw: 'קה', elodim: 'אלוקים' }) },
];

PREVIEW_CASES.forEach((answers, index) => {
  test(`the setup preview matches the server's transformation (case ${index + 1})`, () => {
    const preview = loadPreview();
    const { context: firstRun } = load();
    const prefs = Object.assign(seededDefaults(), plain(firstRun.planFirstRunPreferences_(answers, seededDefaults()).changes));
    const sample = { type: 'Tanakh', he: preview.SETUP_SAMPLE_HE, text: preview.SETUP_SAMPLE_EN };
    assert.deepEqual(plain(preview.setupPreviewText_(answers)), plain(serverPreview(prefs, sample)));
  });
});

test('the preview sample really shows the choices: the Name, vowels and "God" all change it', () => {
  const preview = loadPreview();
  const base = preview.setupPreviewText_({ vowels: 'always', teamim: true, divine: {} });
  const named = preview.setupPreviewText_({ vowels: 'always', teamim: true, divine: { meforash: { on: true, text: 'יי' }, god: { on: true, text: 'G-d' } } });
  assert.ok(!base.he.includes('יי') && named.he.includes('יי'));
  assert.match(named.en, /our G-d,/);
  assert.notEqual(preview.setupPreviewText_({ vowels: 'never', teamim: true, divine: {} }).he, base.he);
  assert.notEqual(preview.setupPreviewText_({ vowels: 'always', teamim: false, divine: {} }).he, base.he);
});
