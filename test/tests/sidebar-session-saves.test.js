const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// The sidebar's session saves (Insertion Options' switches) go to the server
// one at a time. setSidebarSessionState reads, merges and writes the whole
// session, so two saves in flight at once could each read the old session and
// the later write dropped the earlier change: a Vowels choice followed quickly
// by any other click was lost (reported as "the vowel selection is ignored"),
// and each answer re-applied its own snapshot, flipping the second switch
// back on screen. See preferences-state.html saveSessionPreference.

const read = (file) => fs.readFileSync(file, 'utf8').replace(/<\/?script>/g, '');

function load() {
  const calls = [];
  let server = {};
  const applied = [];
  const context = {
    console,
    showSidebarToast() {},
    google: {
      script: {
        run: {
          withSuccessHandler(ok) {
            return {
              withFailureHandler() {
                return {
                  setSidebarSessionState(id, payload) {
                    calls.push({ payload: { ...payload }, answer() { server = { ...server, ...payload }; ok({ ...server }); } });
                  },
                };
              },
            };
          },
        },
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(read('apps-script/shared/ui/core-shared.html'), context);
  vm.runInContext(read('apps-script/sidebar/js/preferences-state.html'), context);
  vm.runInContext('sidebarSessionId = "s1"; accountPreferences = { nekudot: "true", teamim: "true" };', context);
  context.applyEffectivePreferencesToUI = () => applied.push({ ...vm.runInContext('effectivePreferences', context) });
  return { ctx: context, calls, applied, get: (name) => vm.runInContext(name, context) };
}

test('a change shows at once, before the server answers', () => {
  const { ctx, get } = load();
  ctx.saveSessionPreference({ nekudot: 'false' });
  assert.equal(get('effectivePreferences').nekudot, 'false');
});

test('a second change waits for the first save, then goes with every change made meanwhile', () => {
  const { ctx, calls } = load();
  ctx.saveSessionPreference({ nekudot: 'false', nekudot_filter: 'false' });
  ctx.saveSessionPreference({ hebrew_punctuation: 'false' });
  ctx.saveSessionPreference({ teamim: 'false' });
  assert.equal(calls.length, 1, 'only one save in flight');
  calls[0].answer();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].payload, { hebrew_punctuation: 'false', teamim: 'false' });
  calls[1].answer();
  const session = vm.runInContext('sessionPreferences', ctx);
  assert.equal(session.nekudot, 'false', 'the first change is not lost');
  assert.equal(session.teamim, 'false');
});

test('the switches are re-read from the server only when nothing is left to send', () => {
  const { ctx, calls, applied } = load();
  ctx.saveSessionPreference({ nekudot: 'false' });
  ctx.saveSessionPreference({ teamim: 'false' });
  calls[0].answer();
  assert.equal(applied.length, 0, 'a stale answer must not flip the second switch back');
  calls[1].answer();
  assert.equal(applied.length, 1);
  assert.equal(applied[0].nekudot, 'false');
  assert.equal(applied[0].teamim, 'false');
});

test('each caller hears back once its own change is saved', () => {
  const { ctx, calls } = load();
  const heard = [];
  ctx.saveSessionPreference({ nekudot: 'false' }, () => heard.push('vowels'));
  ctx.saveSessionPreference({ teamim: 'false' }, () => heard.push('cantillation'));
  calls[0].answer();
  assert.deepEqual(heard, ['vowels']);
  calls[1].answer();
  assert.deepEqual(heard, ['vowels', 'cantillation']);
});

test('a change the fetch applies disables Add Source and fetches once, after the saves land', () => {
  const source = read('apps-script/sidebar/js/composition-controls.html');
  assert.doesNotMatch(source, /if \(hasResolvedReference && data && data\.ref\) refreshSelectedResult\(\)/,
    'per-save refetches skipped a change made while an earlier fetch ran');
  const fn = source.match(/function scheduleSelectedResultRefresh\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(fn, /hasResolvedReference = false;\s*setInsertButtonState\(false\);/);
  assert.match(fn, /sessionSaveQueue\.inFlight \|\| sessionSaveQueue\.pending/);
});

// BUG-002 (T04): Stacked, chosen and inserted at once, came out Right-Left,
// and Insertion Options then showed Right-Left. Until the bootstrap answers
// the sidebar has no session id, and a change made then was dropped; the
// bootstrap then re-drew the saved default over it. It now waits, is kept over
// the bootstrap's state, and is sent once the session exists.
test('a change made before the sidebar has its session is kept, shown and then sent', () => {
  const { ctx, calls, get } = load();
  vm.runInContext('sidebarSessionId = null; accountPreferences = { bilingual_layout_default: "he-right" };', ctx);

  ctx.saveSessionPreference({ bilingual_layout_default: 'he-top' });
  assert.equal(calls.length, 0, 'nothing can be sent without a session');
  assert.equal(get('effectivePreferences').bilingual_layout_default, 'he-top', 'shown at once');

  // The bootstrap arrives with the saved default and an empty session.
  const kept = ctx.adoptSidebarSession('s1', {});
  assert.equal(kept, true);
  assert.equal(get('sessionPreferences').bilingual_layout_default, 'he-top', 'the bootstrap does not undo it');
  ctx.flushSessionSaves_();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].payload, { bilingual_layout_default: 'he-top' });
});

test('with no early change the bootstrap\'s session is taken as it is', () => {
  const { ctx, get } = load();
  vm.runInContext('sidebarSessionId = null;', ctx);
  assert.equal(ctx.adoptSidebarSession('s1', { nekudot: 'false' }), false);
  assert.equal(get('sidebarSessionId'), 's1');
  assert.deepEqual({ ...get('sessionPreferences') }, { nekudot: 'false' });
});

// The settings buttons are usable after one earlier override has saved. A
// teacher can then change Vowels and immediately Revert, save the defaults,
// or pick a different profile while that latest setting is still in flight.
// Run those production client functions with controllable server completion.
function loadActions() {
  const calls = [];
  const toasts = [];
  const busy = [];
  const refreshed = [];
  const props = {};
  let server = { source_notes_mode: 'inline' };
  let account = { nekudot: 'true', teamim: 'true', source_notes_mode: 'omit' };
  const $ = (selector) => {
    const api = {
      prop(key, value) { props[selector + ':' + key] = value; return api; },
      attr() { return api; }, removeAttr() { return api; }, toggle() { return api; },
      text() { return api; }, empty() { return api; }, val() { return api; }, appendTo() { return api; },
    };
    return api;
  };
  const run = {
    withSuccessHandler(ok) {
      let fail = () => {};
      const api = {
        withFailureHandler(fn) { fail = fn; return api; },
        setSidebarSessionState(id, payload) {
          calls.push({ name: 'set', payload: { ...payload }, answer() {
            server = { ...server, ...payload }; ok({ ...server });
          }, fail() { fail(new Error('session storage failed')); } });
        },
        clearSidebarSessionState(id) {
          calls.push({ name: 'clear', answer() { server = {}; ok(true); },
            fail() { fail(new Error('clear failed')); } });
        },
        saveSidebarSessionAsAccountDefaults(id) {
          calls.push({ name: 'defaults', answer() {
            account = { ...account, ...server }; server = {}; ok({ ...account });
          }, fail() { fail(new Error('defaults failed')); } });
        },
        switchSettingsProfile(id) {
          calls.push({ name: 'profile', id, answer() {
            account = { nekudot: 'true', teamim: 'true', source_notes_mode: 'separate' };
            ok({ preferences: { ...account }, profiles: { active: id, profiles: [{ id: 'p1', name: 'My settings' }, { id: 'p2', name: 'Handouts' }] } });
          }, fail() { fail(new Error('Could not switch profiles.')); } });
        },
      };
      return api;
    },
  };
  const context = {
    console, $, appMode: 'texts', selectedResultRefreshPending: false, google: { script: { run } },
    showSidebarToast: (message) => toasts.push(message),
    showBusyOverlay: (kind) => busy.push(kind), hideBusyOverlay: () => busy.push('done'),
    updateModeDependentSections() {}, setInsertButtonState() {},
    scheduleSelectedResultRefresh: () => refreshed.push(true),
  };
  vm.createContext(context);
  vm.runInContext(read('apps-script/shared/ui/core-shared.html'), context);
  vm.runInContext(read('apps-script/sidebar/js/preferences-state.html'), context);
  context.applyEffectivePreferencesToUI = () => {};
  vm.runInContext(`
    sidebarSessionId = 's1';
    accountPreferences = ${JSON.stringify(account)};
    sessionPreferences = ${JSON.stringify(server)};
    effectivePreferences = mergePreferenceLayers(accountPreferences, sessionPreferences);
    settingsProfiles = { active: 'p1', profiles: [{ id: 'p1', name: 'My settings' }, { id: 'p2', name: 'Handouts' }] };
    selectedRefValue = 'Genesis 1:1';
    hasResolvedReference = false;
  `, context);
  return {
    ctx: context, calls, toasts, busy, props, refreshed,
    account: () => account, server: () => server,
    expireSession() { server = {}; },
  };
}

test('Save as defaults waits for all queued choices and promotes the visible snapshot', () => {
  const env = loadActions();
  const { ctx, calls } = env;
  ctx.saveSessionPreference({ nekudot: 'false' });
  ctx.saveSessionPreference({ teamim: 'false' });
  ctx.saveSessionAsDefaults();
  assert.deepEqual(calls.map((c) => c.name), ['set']);
  calls[0].answer();
  assert.deepEqual(calls.map((c) => c.name), ['set', 'set']);
  assert.deepEqual(calls[1].payload, { source_notes_mode: 'inline', nekudot: 'false', teamim: 'false' });
  calls[1].answer();
  assert.deepEqual(calls.map((c) => c.name), ['set', 'set', 'defaults']);
  calls[2].answer();
  assert.deepEqual(env.account(), { nekudot: 'false', teamim: 'false', source_notes_mode: 'inline' });
  assert.deepEqual(env.server(), {});
  assert.deepEqual({ ...ctx.sessionPreferences }, {});
  assert.equal(ctx.sessionSaveQueue.action, null);
  assert.equal(env.refreshed.length, 1, 'an already invalidated preview recovers after the action');
});

test('Revert clears only after the last save, so a late save cannot recreate the session', () => {
  const env = loadActions();
  const { ctx, calls } = env;
  let reverted = false;
  ctx.saveSessionPreference({ nekudot: 'false' });
  ctx.saveSessionPreference({ teamim: 'false' });
  ctx.resetSessionOverrides(() => { reverted = true; });
  assert.deepEqual(calls.map((c) => c.name), ['set']);
  calls[0].answer();
  calls[1].answer();
  assert.deepEqual(calls.map((c) => c.name), ['set', 'set', 'clear']);
  calls[2].answer();
  assert.equal(reverted, true);
  assert.deepEqual(env.server(), {});
  assert.deepEqual({ ...ctx.sessionPreferences }, {});
  assert.equal(ctx.effectivePreferences.nekudot, 'true');
});

test('an active session action blocks duplicate actions and queued input, then unlocks', () => {
  const env = loadActions();
  const { ctx, calls } = env;
  ctx.resetSessionOverrides();
  ctx.resetSessionOverrides();
  ctx.saveSessionAsDefaults();
  ctx.switchProfileFromSidebar('p2');
  ctx.saveSessionPreference({ nekudot: 'false' });
  assert.deepEqual(calls.map((c) => c.name), ['clear']);
  assert.equal(ctx.effectivePreferences.nekudot, 'true');
  assert.equal(env.props['#layout-tray .tray-body:inert'], true);
  assert.equal(env.props['#tray-profile-select:disabled'], true);
  calls[0].answer();
  assert.equal(env.props['#layout-tray .tray-body:inert'], false);
  assert.equal(env.props['#tray-profile-select:disabled'], false);
  ctx.saveSessionPreference({ nekudot: 'false' });
  assert.deepEqual(calls.map((c) => c.name), ['clear', 'set']);
});

test('a failed snapshot save never promotes older defaults and can be retried', () => {
  const env = loadActions();
  const { ctx, calls } = env;
  ctx.saveSessionAsDefaults();
  calls[0].fail();
  calls[1].fail();
  assert.deepEqual(calls.map((c) => c.name), ['set', 'set'], 'one bounded retry, then no promotion');
  assert.equal(env.account().source_notes_mode, 'omit');
  assert.equal(ctx.sessionPreferences.source_notes_mode, 'inline');
  assert.equal(ctx.sessionSaveQueue.action, null);
  assert.match(env.toasts.join(' '), /defaults were not changed/);
  ctx.saveSessionAsDefaults();
  calls[2].answer();
  calls[3].answer();
  assert.equal(env.account().source_notes_mode, 'inline');
});

test('failed session saves pause insertion after one retry and retain every choice for an explicit retry', () => {
  const env = loadActions();
  const { ctx, calls } = env;
  let confirmed = 0;
  ctx.hasResolvedReference = true;
  ctx.saveSessionPreference({ nekudot: 'false' }, () => { confirmed++; });
  calls[0].fail();
  assert.equal(ctx.hasResolvedReference, false, 'the failed save cannot leave old text insertable');
  assert.equal(calls.length, 2, 'retry once');
  calls[1].fail();
  assert.equal(calls.length, 2, 'no endless retry');
  assert.equal(ctx.sessionSaveQueue.failed, true);
  assert.equal(ctx.selectedResultRefreshPending, true, 'new references and edition picks remain behind the failed save');
  assert.equal(confirmed, 0, 'a failed save is not reported as complete');
  assert.equal(ctx.effectivePreferences.nekudot, 'false', 'the choice remains visible for retry');
  assert.match(env.toasts.join(' '), /Insertion is paused/);
  ctx.saveSessionPreference({ teamim: 'false' });
  assert.deepEqual(calls[2].payload, { source_notes_mode: 'inline', nekudot: 'false', teamim: 'false' });
  calls[2].answer();
  assert.equal(ctx.sessionSaveQueue.failed, false);
  assert.equal(confirmed, 1);
  assert.equal(env.server().nekudot, 'false');
  assert.equal(env.refreshed.length, 1, 'successful recovery refreshes the paused preview');
});

test('Revert can discard a repeatedly failed snapshot without another save attempt', () => {
  const env = loadActions();
  env.ctx.saveSessionPreference({ nekudot: 'false' });
  env.calls[0].fail();
  env.calls[1].fail();
  env.ctx.resetSessionOverrides();
  assert.deepEqual(env.calls.map((c) => c.name), ['set', 'set', 'clear']);
  env.calls[2].answer();
  assert.equal(env.ctx.sessionSaveQueue.failed, false);
  assert.equal(env.ctx.sessionSaveQueue.pending, null);
  assert.equal(env.ctx.effectivePreferences.nekudot, 'true');
  assert.deepEqual(env.server(), {});
});

test('Save as defaults restores the visible session if its server cache expired', () => {
  const env = loadActions();
  env.expireSession();
  env.ctx.saveSessionAsDefaults();
  env.calls[0].answer();
  env.calls[1].answer();
  assert.equal(env.account().source_notes_mode, 'inline');
});

test('a failed Revert preserves the visible session, reports failure, and releases the controls', () => {
  const env = loadActions();
  let success = false;
  env.ctx.resetSessionOverrides(() => { success = true; });
  env.calls[0].fail();
  assert.equal(success, false);
  assert.equal(env.ctx.sessionPreferences.source_notes_mode, 'inline');
  assert.equal(env.ctx.sessionSaveQueue.action, null);
  assert.match(env.toasts.join(' '), /Could not revert/);
  assert.equal(env.props['#layout-tray .tray-body:inert'], false);
});

test('a profile switch waits for saves and holds the controls until its old session is cleared', () => {
  const env = loadActions();
  const { ctx, calls } = env;
  ctx.saveSessionPreference({ nekudot: 'false' });
  ctx.switchProfileFromSidebar('p2');
  assert.deepEqual(calls.map((c) => c.name), ['set']);
  calls[0].answer();
  assert.deepEqual(calls.map((c) => c.name), ['set', 'profile']);
  calls[1].answer();
  assert.deepEqual(calls.map((c) => c.name), ['set', 'profile', 'clear']);
  assert.ok(ctx.sessionSaveQueue.action);
  assert.equal(env.props['#tray-profile-select:disabled'], true);
  calls[2].answer();
  assert.equal(ctx.sessionSaveQueue.action, null);
  assert.deepEqual(env.server(), {});
  assert.equal(ctx.settingsProfiles.active, 'p2');
  assert.equal(ctx.effectivePreferences.nekudot, 'true');
  assert.equal(ctx.effectivePreferences.source_notes_mode, 'separate');
});

test('a profile changed in Preferences clears its session only after an outstanding setting save', () => {
  const env = loadActions();
  env.ctx.saveSessionPreference({ nekudot: 'false' });
  env.ctx.adoptSettingsProfiles({ active: 'p2', profiles: [{ id: 'p1', name: 'My settings' }, { id: 'p2', name: 'Handouts' }] });
  assert.deepEqual(env.calls.map((c) => c.name), ['set']);
  env.calls[0].answer();
  assert.deepEqual(env.calls.map((c) => c.name), ['set', 'clear']);
  env.calls[1].answer();
  assert.deepEqual(env.server(), {});
  assert.deepEqual({ ...env.ctx.sessionPreferences }, {});
});

test('a failed profile clear says the profile already changed and lets Revert finish it', () => {
  const env = loadActions();
  env.ctx.switchProfileFromSidebar('p2');
  env.calls[0].answer();
  env.calls[1].fail();
  assert.equal(env.ctx.settingsProfiles.active, 'p2');
  assert.equal(env.ctx.effectivePreferences.source_notes_mode, 'inline');
  assert.equal(env.ctx.sessionSaveQueue.action, null);
  assert.match(env.toasts.join(' '), /profile changed.*Click Revert/);
  env.ctx.resetSessionOverrides();
  env.calls[2].answer();
  assert.equal(env.ctx.effectivePreferences.source_notes_mode, 'separate');
});
