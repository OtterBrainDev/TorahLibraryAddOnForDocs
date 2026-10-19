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
