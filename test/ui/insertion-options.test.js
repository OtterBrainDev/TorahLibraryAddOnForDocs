// The Display & Layout pickers exist once: shared/insertion-options (markup,
// css, js). The sidebar's Layout tray, the Link Texts dialog's "Customize this
// insertion" panel and Preferences all include them. Before, Preferences had
// its own markup (other titles, other data attributes), its own copy of the
// CSS, and its own click handling, and the copies had drifted: it never hid
// Layout for a translation-only insert, and it called the options "Both" and
// "Hebrew only" where the sidebar said "Original with Translation" and
// "Original". These tests fail if a host grows a private copy again.
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { ROOT, readAppScriptFile } = require('./test-utils');

const APPS_SCRIPT = path.join(ROOT, 'apps-script');
const SHARED = 'shared/insertion-options';
const HOSTS = {
  'sidebar.html': 'sidebar/js/display-controls.html',
  'preferences.html': 'preferences/js.html',
  'linker-results.html': 'linker-results.html',
};

function allHtmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return allHtmlFiles(full);
    return entry.name.endsWith('.html') ? [path.relative(APPS_SCRIPT, full).replace(/\\/g, '/')] : [];
  });
}

test('every host includes the shared markup, css and js, and initialises it', () => {
  Object.entries(HOSTS).forEach(([template, adapter]) => {
    const html = readAppScriptFile(template);
    for (const part of ['markup', 'css', 'js']) {
      assert.ok(html.includes(`include('${SHARED}/${part}')`), `${template} does not include ${SHARED}/${part}`);
    }
    // The js partial must come before the host script that calls it.
    const adapterSource = readAppScriptFile(adapter);
    assert.match(adapterSource, /initInsertionOptions\(\{/, `${adapter} never calls initInsertionOptions`);
  });
});

test('no page has its own Display or Layout cards', () => {
  const offenders = allHtmlFiles(APPS_SCRIPT)
    .filter((file) => file !== `${SHARED}/markup.html`)
    .filter((file) => /class="(mode-card|layout-option)[" ]/.test(fs.readFileSync(path.join(APPS_SCRIPT, file), 'utf8')));
  assert.deepEqual(offenders, []);
});

test('no stylesheet but the shared one styles the Display or Layout cards', () => {
  // css/utilities.html only lists them among controls that get
  // vertical-align: middle; it sets nothing else on them.
  const allowed = new Set([`${SHARED}/css.html`, 'css/utilities.html']);
  const pattern = /\.(mode-card(?![a-z-]*-group\b)(?!-content|-symbol|-plus|-label|-indicator)|layout-option|layout-icon|layout-col|layout-row|display-choice-)/;
  const offenders = [];
  allHtmlFiles(APPS_SCRIPT).filter((file) => !allowed.has(file)).forEach((file) => {
    const source = fs.readFileSync(path.join(APPS_SCRIPT, file), 'utf8');
    for (const style of source.match(/<style>[\s\S]*?<\/style>/g) || []) {
      for (const block of style.replace(/\/\*[\s\S]*?\*\//g, '').split('}')) {
        const selector = block.split('{')[0];
        if (block.includes('{') && pattern.test(selector)) offenders.push(`${file}: ${selector.trim().split('\n').pop()}`);
      }
    }
  });
  assert.deepEqual(offenders, []);
});

test('the pickers name the options the same everywhere', () => {
  const markup = readAppScriptFile(`${SHARED}/markup.html`);
  for (const title of ['Translation', 'Original with Translation', 'Original', 'Stacked', 'Right–Left', 'Left–Right']) {
    assert.ok(markup.includes(`title="${title}"`), `missing option "${title}"`);
  }
});
