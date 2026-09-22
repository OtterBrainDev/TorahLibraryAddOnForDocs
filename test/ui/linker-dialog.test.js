// The Link Texts with Sefaria dialog: structural pins for the two things that
// went wrong in it (see docs/regression-log.md).
const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const html = readAppScriptFile('linker-results.html');

test('linker dialog: [hidden] beats the display:flex on its state containers', () => {
  // The four states (scanning / review / applying / done) are switched with
  // the `hidden` attribute. `.centered-state { display: flex }` overrides the
  // browser's own [hidden] rule, so without an explicit one every state
  // rendered at once and the review table was squeezed between them.
  assert.match(html, /\.centered-state\s*\{[^}]*display:\s*flex/);
  assert.match(html, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
});

test('linker dialog: Link and Insert are separate checkbox columns', () => {
  assert.match(html, /id="master-link-cb"/);
  assert.match(html, /id="master-insert-cb"/);
  assert.match(html, /'link-cb'/);
  assert.match(html, /'insert-cb'/);
  // Insertion is chosen per row now; the dialog must not fall back to the
  // preference, which only applies to the quiet (no-dialog) mode.
  assert.doesNotMatch(html, /insertAfterLinking/);
});

test('scan report no longer carries insertAfterLinking (dialog decides per row)', () => {
  const server = readAppScriptFile('server/document-actions.gs');
  assert.doesNotMatch(server, /insertAfterLinking\s*:/);
  // The quiet pass is the one remaining reader of the preference.
  assert.match(server, /function runQuietLinkPass_[\s\S]*linkerInsertsAfterLinking_\(/);
});

test('preferences: "Insert text after linking" lives in the Linking tab, not Experimental', () => {
  const prefs = readAppScriptFile('preferences.html');
  const linking = prefs.indexOf('id="pref-tab-linking"');
  const experimental = prefs.indexOf('id="pref-tab-experimental"');
  const toggle = prefs.indexOf('id="link_sources_insert_after_linking"');
  assert.ok(linking > 0, 'Linking tab panel is missing');
  assert.ok(toggle > linking && (experimental < 0 || toggle < experimental),
    'link_sources_insert_after_linking must be inside the Linking tab');
  assert.equal(prefs.split('id="link_sources_insert_after_linking"').length - 1, 1);
  // Scanning and review controls moved with it.
  for (const id of ['linker_scan_mode', 'linker_review_mode']) {
    const at = prefs.indexOf(`id="${id}"`);
    assert.ok(at > linking && (experimental < 0 || at < experimental), `${id} must be inside the Linking tab`);
  }
});
