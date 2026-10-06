const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Google's add-on stylesheet (ssl.gstatic.com/docs/script/css/add-ons.css)
// styles bare form controls with selectors that out-rank a single class, so
// its patterned background showed through the Session Library's sort
// dropdown. The fix: Google's sheet is imported into the cascade layer
// `google-addons`, and shared/css/native-controls (layer `native-controls`,
// declared after it) sets the base look of every control type. These tests
// keep both halves in place, and fail when a page starts using a control type
// that has no base rule there.

const APPS_SCRIPT = path.resolve(__dirname, '../../apps-script');
const read = (rel) => fs.readFileSync(path.join(APPS_SCRIPT, rel), 'utf8');
const NATIVE = read('shared/css/native-controls.html');
const LAYER_ORDER = /@layer google-addons, native-controls;/;
const LAYERED_IMPORT = /@import url\("https:\/\/ssl\.gstatic\.com\/docs\/script\/css\/add-ons\.css"\) layer\(google-addons\);/;

function htmlFiles(dir = APPS_SCRIPT) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function entryPages() {
  return fs.readdirSync(APPS_SCRIPT)
    .filter((name) => name.endsWith('.html'))
    .filter((name) => /<html[\s>]/i.test(read(name)));
}

function layerBody() {
  const start = NATIVE.indexOf('@layer native-controls {');
  assert.ok(start >= 0, 'native-controls.html has no `@layer native-controls { … }` block');
  return NATIVE.slice(start);
}

test("Google's add-on stylesheet is only ever loaded into the google-addons layer", () => {
  const loaders = htmlFiles().filter((file) => /(@import|<link)[^;>]*add-ons\.css/.test(fs.readFileSync(file, 'utf8')));
  assert.ok(loaders.length >= 2, `expected shared/ui/head and release-notes to load add-ons.css, found ${loaders}`);
  loaders.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    if (!/(@import|<link)[^;>]*add-ons\.css/.test(html)) return;
    const rel = path.relative(APPS_SCRIPT, file);
    assert.ok(!/<link[^>]+add-ons[^>]*\.css/.test(html), `${rel} loads add-ons.css with a <link>; import it into layer(google-addons) instead`);
    assert.match(html, LAYERED_IMPORT, `${rel} loads add-ons.css without layer(google-addons)`);
    assert.match(html, LAYER_ORDER, `${rel} must declare the layer order google-addons, native-controls before the import`);
    assert.ok(html.search(LAYER_ORDER) < html.search(LAYERED_IMPORT), `${rel}: the @layer order statement must come before the @import`);
  });
});

test('every page that loads shared/ui/head also includes shared/css/native-controls', () => {
  const pages = entryPages().filter((name) => read(name).includes("include('shared/ui/head')"));
  assert.ok(pages.length >= 5, `expected the templated entry pages, found ${pages}`);
  pages.forEach((name) => {
    const html = read(name);
    const head = html.indexOf("include('shared/ui/head')");
    const native = html.indexOf("include('shared/css/native-controls')");
    assert.ok(native > head, `${name} must include shared/css/native-controls after shared/ui/head`);
  });
});

test('native-controls keeps its rules inside the native-controls layer', () => {
  const beforeLayer = NATIVE.slice(0, NATIVE.indexOf('@layer native-controls {'));
  // Outside the layer only the :root token block is allowed: an unlayered rule
  // here would out-rank component rules instead of sitting beneath them.
  const css = beforeLayer.replace(/<style>|\/\*[\s\S]*?\*\//g, '').replace(/:root\s*\{[^}]*\}/, '').trim();
  assert.equal(css, '', `unexpected rules outside @layer native-controls: ${css.slice(0, 120)}`);
});

test('every native control type the add-on uses has a base rule', () => {
  const body = layerBody();
  const covered = (selector) => body.includes(selector);

  ['select', 'select option', 'textarea', 'button', 'button.blue', ':disabled', ':focus-visible']
    .forEach((selector) => assert.ok(covered(selector), `native-controls has no rule for ${selector}`));

  // A dropdown's chevron is the one thing a component's `background:` shorthand
  // must not erase, and a list box must never get one.
  assert.match(body, /background-image: var\(--select-chevron\) !important;/);
  assert.match(body, /select\[multiple\][\s\S]*?background-image: none !important;/);

  const used = new Set();
  htmlFiles().forEach((file) => {
    const html = fs.readFileSync(file, 'utf8').replace(/\\"/g, '"');
    for (const m of html.matchAll(/<input\b[^>]*>/g)) {
      const type = (m[0].match(/\btype="([^"]+)"/) || [, 'text'])[1].toLowerCase();
      if (type !== 'hidden') used.add(type);
    }
  });
  assert.ok(used.size > 0, 'found no <input> elements to check');
  used.forEach((type) => {
    assert.ok(covered(`input[type="${type}"]`), `<input type="${type}"> is used but native-controls has no input[type="${type}"] rule`);
  });
});
