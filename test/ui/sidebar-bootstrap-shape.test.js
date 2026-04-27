const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

// Static check: inspect the source of `getSidebarBootstrapData` and confirm it
// returns an object literal whose keys match the contract. A reshape of the
// return value catches here (and before) the inevitable silent-sidebar-break.
test('getSidebarBootstrapData source returns the contract-shaped object literal', () => {
  const src = fs.readFileSync(path.join(ROOT, 'apps-script/server/menu.gs'), 'utf8');
  const schema = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'test/ui/contracts/sidebar-bootstrap.schema.json'), 'utf8')
  );

  const fnStart = src.indexOf('function getSidebarBootstrapData(');
  assert.ok(fnStart >= 0, 'getSidebarBootstrapData must exist in apps-script/server/menu.gs');
  // Extract the function body up to its matching closing brace.
  const braceOpen = src.indexOf('{', fnStart);
  let depth = 0;
  let i = braceOpen;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  const body = src.slice(fnStart, i);

  for (const key of schema.required) {
    const keyRegex = new RegExp(`(^|[^A-Za-z0-9_$])${key}\\s*:`);
    assert.match(
      body,
      keyRegex,
      `getSidebarBootstrapData's return literal must include '${key}'. ` +
      `If this field was renamed, update test/ui/contracts/sidebar-bootstrap.schema.json ` +
      `AND apps-script/sidebar/js/bootstrap.html in the same commit, then add a row to docs/regression-log.md.`
    );
  }
});

// Runtime check: actually invoke the function with a stubbed Apps Script
// environment and assert the returned shape against the schema. This is the
// stronger of the two tests — it exercises the real code path.
test('getSidebarBootstrapData returns an object with every contract key at the declared type', () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'test/ui/contracts/sidebar-bootstrap.schema.json'), 'utf8')
  );
  const propsStore = {};
  const cacheStore = {};
  const context = {
    console,
    Logger: { log() {} },
    HtmlService: {},
    DocumentApp: {},
    UrlFetchApp: {},
    Utilities: { getUuid() { return 'uuid-test'; } },
    PropertiesService: {
      getUserProperties() {
        return {
          getProperty(name) { return Object.prototype.hasOwnProperty.call(propsStore, name) ? propsStore[name] : null; },
          setProperty(name, value) { propsStore[name] = String(value); },
          getProperties() { return Object.assign({}, propsStore); },
        };
      },
    },
    CacheService: {
      getUserCache() {
        return {
          get(key) { return Object.prototype.hasOwnProperty.call(cacheStore, key) ? cacheStore[key] : null; },
          put(key, value) { cacheStore[key] = value; },
          remove(key) { delete cacheStore[key]; },
        };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/migrations.gs'), 'utf8'), context, { filename: 'migrations.gs' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/server/preferences.gs'), 'utf8'), context, { filename: 'preferences.gs' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/server/menu.gs'), 'utf8'), context, { filename: 'menu.gs' });

  const bootstrap = context.getSidebarBootstrapData('texts', null);
  for (const key of schema.required) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(bootstrap, key),
      `getSidebarBootstrapData result missing key '${key}'. Client sidebar code reads this at load.`
    );
    const expectedType = schema.types[key];
    if (expectedType) {
      const actualType = Array.isArray(bootstrap[key]) ? 'array' : typeof bootstrap[key];
      assert.equal(
        actualType,
        expectedType,
        `Key '${key}' has wrong type: expected ${expectedType}, got ${actualType}.`
      );
    }
  }
});
