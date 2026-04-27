const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadAppsScriptFiles(files, propertyMap = {}) {
  // Record each operation the element received so we can assert against it.
  const ops = [];

  function fakeElement() {
    const api = {
      editAsText() { return api; },
      getText() { return ''; },
      appendText(t) { ops.push({ op: 'text', value: t }); return api; },
      setBold() { return api; },
      setItalic() { return api; },
      setUnderline() { return api; },
      insertText() { return api; },
      getNumChildren() { return 0; },
      setText() { return api; },
      setAttributes() { return api; },
      setBackgroundColor() { return api; },
      setForegroundColor() { return api; },
      setFontFamily() { return api; },
      setFontSize() { return api; },
      setLeftToRight() { return api; },
      appendParagraph() { return api; },
    };
    return api;
  }

  const context = {
    console,
    Logger: { log() {} },
    HtmlService: {},
    DocumentApp: {
      Attribute: new Proxy({}, { get: (_, k) => String(k) }),
    },
    UrlFetchApp: {},
    Utilities: {},
    PropertiesService: {
      getUserProperties() {
        return {
          getProperty(name) {
            return Object.prototype.hasOwnProperty.call(propertyMap, name) ? propertyMap[name] : null;
          },
          setProperty() {},
        };
      },
    },
    _ops: ops,
    _fakeElement: fakeElement,
  };
  vm.createContext(context);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context;
}

// The `extendedGemaraPreference` variable used to be module-scope and only
// got set on sidebar open. Quick-Actions menu paths (which never open the
// sidebar) read a stale `false`, so Steinsaltz-style `<strong>` and `<i>`
// markup was never stripped even when the user had set the preference.
// The fix is to read the preference at call time inside
// `insertRichTextFromHTML`. These tests pin that.

test('insertRichTextFromHTML reads extended_gemara at call time, not module init time', () => {
  // Use a string-search probe: the function sets a local const from
  // PropertiesService.getUserProperties().getProperty("extended_gemara").
  // If that read gets moved back to module scope, this assertion catches it.
  const src = fs.readFileSync('apps-script/server/insertion.gs', 'utf8');
  const fnStart = src.indexOf('function insertRichTextFromHTML(');
  assert.ok(fnStart >= 0, 'insertRichTextFromHTML must exist in apps-script/server/insertion.gs');
  const fnBody = src.slice(fnStart, fnStart + 4000);
  assert.match(
    fnBody,
    /getProperty\(\s*["']extended_gemara["']\s*\)/,
    'insertRichTextFromHTML must read the `extended_gemara` preference directly (not via a stale module-scope global)'
  );
});

test('the dead module-scope `extendedGemaraPreference` global is gone', () => {
  const src = fs.readFileSync('apps-script/server/insertion.gs', 'utf8');
  // The previous pattern was `let extendedGemaraPreference = false;` at top
  // level, plus a set inside openSharedSidebar_. Both must be gone.
  assert.equal(
    /^let\s+extendedGemaraPreference\s*=/m.test(src),
    false,
    'The module-scope `let extendedGemaraPreference = ...;` global must not be reintroduced.'
  );
  // The anti-pattern is a bare reassignment (no const/let/var) at module scope
  // or inside an entry-point handler, which is what the buggy sidebar setter
  // looked like. The current local declaration `const extendedGemaraPreference = ...`
  // inside insertRichTextFromHTML is fine and must not be flagged.
  assert.equal(
    /(?<![.\w])(?<!(const|let|var)\s)extendedGemaraPreference\s*=\s*PropertiesService/m.test(src),
    false,
    'The sidebar-open-time setter `extendedGemaraPreference = PropertiesService...` must not be reintroduced.'
  );
});
