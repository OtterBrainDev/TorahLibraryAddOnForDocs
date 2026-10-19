const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Pins the server -> template JSON hand-off.
//
// Templates embed server data with a force-print inside an inline <script>:
//
//   <script>var _slInitData = <?!= sessionDataJson ?>;</script>
//
// Plain JSON.stringify does not escape "<", so a string value containing
// "</script>" ends the script element and whatever follows is parsed as HTML.
// Session Library entries carry source-sheet titles, which anyone can publish
// on Sefaria — a sheet titled "</script><img src=x onerror=...>" ran script in
// that dialog. toEmbeddedJson_ (ui_core.gs) escapes "<" and the two JS line
// terminators; every template variable that is force-printed must go through it.

const ROOT = path.resolve(__dirname, '..', '..');
const APPS_SCRIPT = path.join(ROOT, 'apps-script');

function walk(dir, ext) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, ext);
    return entry.name.endsWith(ext) ? [full] : [];
  });
}

function loadToEmbeddedJson() {
  const src = fs.readFileSync(path.join(APPS_SCRIPT, 'ui_core.gs'), 'utf8');
  const match = src.match(/function toEmbeddedJson_\(value\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'expected toEmbeddedJson_ in ui_core.gs');
  const context = {};
  vm.createContext(context);
  vm.runInContext(match[0], context);
  return context.toEmbeddedJson_;
}

test('toEmbeddedJson_ output cannot close the surrounding <script>', () => {
  const toEmbeddedJson_ = loadToEmbeddedJson();
  const value = { label: '</script><img src=x onerror=alert(1)>', sep: 'a\u2028b\u2029c' };

  const out = toEmbeddedJson_(value);

  assert.ok(!out.includes('<'), `unescaped "<" in ${out}`);
  assert.ok(!/[\u2028\u2029]/.test(out), 'unescaped line terminator');
  // Still the same data once the page's JS parser reads it.
  assert.deepEqual(JSON.parse(out), value);
});

test('every force-printed template variable inside <script> is set via toEmbeddedJson_', () => {
  // Names force-printed (<?!= name ?>) inside an inline <script> in any template.
  const forcePrinted = new Set();
  walk(APPS_SCRIPT, '.html').forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
    scripts.forEach((body) => {
      for (const m of body.matchAll(/<\?!=\s*([A-Za-z_$][\w$]*)\s*;?\s*\?>/g)) {
        forcePrinted.add(m[1]);
      }
    });
  });

  assert.ok(forcePrinted.size > 0, 'expected at least one force-printed script variable');

  const assignments = [];
  walk(APPS_SCRIPT, '.gs').forEach((file) => {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\btemplate\.([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/g)) {
      if (forcePrinted.has(m[1])) {
        assignments.push({ file: path.relative(ROOT, file), name: m[1], rhs: m[2].trim() });
      }
    }
  });

  assert.ok(assignments.length > 0, 'expected template assignments for force-printed variables');
  assignments.forEach(({ file, name, rhs }) => {
    assert.ok(
      rhs.startsWith('toEmbeddedJson_('),
      `${file}: template.${name} is force-printed inside <script> but assigned ${rhs}`
    );
  });
});
