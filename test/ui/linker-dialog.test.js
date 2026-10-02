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

test('linker dialog: "Customize this insertion" uses the shared insertion options, for this pass only', () => {
  // Served as a template so it can include() the same Display & Layout pickers
  // and composition card as the sidebar's Layout tray. A plain file would
  // print the include tags as text.
  const server = readAppScriptFile('server/document-actions.gs');
  assert.match(server, /createTemplateFromFile\('linker-results'\)\s*\.evaluate\(\)/);
  assert.doesNotMatch(server, /createHtmlOutputFromFile\('linker-results'\)/);

  assert.match(html, /<details class="customize-insertion"/);
  assert.match(html, /initInsertionOptions\(\{\s*root: '#customize-root'/);
  assert.match(html, /initCompositionCard\(\{/);
  // The panel's settings go with every insert of the pass, as overrides; they
  // are saved only from "Save as defaults".
  assert.match(html, /\.insertLinkedSourceAtPosition\(item\.ref, item, overrides\)/);
  assert.match(html, /var overrides = changedInsertPrefs\(\);/);
  assert.equal((html.match(/\.setPreferences\(/g) || []).length, 1);
  assert.match(html, /\.setPreferences\(changed\)/);
  // Still no innerHTML sink in this dialog.
  assert.doesNotMatch(html, /\.innerHTML\s*=/);
  assert.doesNotMatch(html, /\.html\(/);
});

test('every key the dialog can override is one the server accepts', () => {
  const server = readAppScriptFile('server/document-actions.gs');
  const block = server.match(/var LINKER_INSERT_OVERRIDE_KEYS_ = \{([\s\S]*?)\n\};/)[1];
  const serverKeys = [...block.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]).sort();
  const clientBlock = html.match(/var INSERT_PREF_KEYS = \[([\s\S]*?)\];/)[1];
  const clientKeys = [...clientBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(clientKeys, serverKeys);
});
