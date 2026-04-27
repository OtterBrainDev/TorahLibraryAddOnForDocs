const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const APPS_SCRIPT = path.join(ROOT, 'apps-script');
const SURFACE = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/rpc-surface.json'), 'utf8'));

function walk(dir, filterExt) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filterExt));
    else if (full.endsWith(filterExt)) out.push(full);
  }
  return out;
}

const gsFiles = walk(APPS_SCRIPT, '.gs');
const htmlFiles = walk(APPS_SCRIPT, '.html');

function readAll(files) {
  return files.map((f) => ({ path: f, text: fs.readFileSync(f, 'utf8') }));
}

const gsSources = readAll(gsFiles);
const htmlSources = readAll(htmlFiles);

function findFunctionDefinition(name) {
  const defRe = new RegExp(`^function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{`, 'm');
  for (const { path: p, text } of gsSources) {
    const m = defRe.exec(text);
    if (m) {
      const raw = m[1].trim();
      const arity = raw.length === 0 ? 0 : splitParams(raw).length;
      return { path: path.relative(ROOT, p).replace(/\\/g, '/'), arity };
    }
  }
  return null;
}

function splitParams(src) {
  const parts = [];
  let depth = 0, cur = '';
  for (const c of src) {
    if ('([{'.includes(c)) { depth++; cur += c; }
    else if (')]}'.includes(c)) { depth--; cur += c; }
    else if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

test('every function in rpc-surface.json still exists with the declared arity', () => {
  for (const decl of SURFACE.functions) {
    const found = findFunctionDefinition(decl.name);
    assert.ok(
      found,
      `Server function '${decl.name}' is in docs/rpc-surface.json but no 'function ${decl.name}(...)' definition exists under apps-script/. If this rename is intentional, update the surface and add a row to docs/regression-log.md.`
    );
    assert.equal(
      found.arity,
      decl.arity,
      `Arity of '${decl.name}' changed: rpc-surface.json says ${decl.arity}, definition has ${found.arity} (at ${found.path}). The sidebar / dialog callers pass a fixed number of arguments; changing arity silently breaks them.`
    );
  }
});

const HELPERS = new Set(['withSuccessHandler', 'withFailureHandler', 'withUserObject']);
const callRe = /\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/;

function extractRpcCalls(text) {
  const calls = [];
  const re = /google\.script\.run\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    let pos = m.index + m[0].length;
    while (true) {
      while (pos < text.length && ' \t\r\n'.includes(text[pos])) pos++;
      const rest = text.slice(pos);
      const mm = callRe.exec(rest);
      if (!mm || mm.index !== 0) break;
      const name = mm[1];
      if (!HELPERS.has(name)) { calls.push(name); break; }
      let depth = 1;
      let p = pos + mm[0].length;
      while (p < text.length && depth > 0) {
        if (text[p] === '(') depth++;
        else if (text[p] === ')') depth--;
        p++;
      }
      pos = p;
    }
  }
  return calls;
}

test('every google.script.run.X call in client HTML resolves to a surface-listed function', () => {
  const listedNames = new Set(SURFACE.functions.map((f) => f.name));
  const known = new Set((SURFACE._knownBrokenCalls || []).map((c) => c.name));
  const unresolved = [];
  for (const { path: p, text } of htmlSources) {
    for (const name of extractRpcCalls(text)) {
      if (!listedNames.has(name) && !known.has(name)) {
        unresolved.push({ name, file: path.relative(ROOT, p).replace(/\\/g, '/') });
      }
    }
  }
  assert.deepEqual(
    unresolved,
    [],
    `Client HTML calls server functions not in docs/rpc-surface.json:\n${unresolved
      .map((u) => `  - ${u.name} (from ${u.file})`)
      .join('\n')}\nEither add the function to the surface and confirm it exists, or add it to _knownBrokenCalls with an explanation.`
  );
});
