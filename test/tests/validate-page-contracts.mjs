import fs from 'fs';
import path from 'path';

const CONTRACT_PATH = process.env.JS_CONTRACT_PATH || 'tests/fixtures/expected-js-contract.json';

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fileExists(file) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function readFileIfExists(file) {
  return fileExists(file) ? fs.readFileSync(file, 'utf8') : '';
}

function unique(values) {
  return [...new Set(values)];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findRepoFiles() {
  const cwd = process.cwd();
  const all = fs.readdirSync(cwd);
  const files = all.filter((name) => fileExists(name));

  const htmlFiles = files.filter((name) => /\.html$/i.test(name));
  const jsHtmlFiles = files.filter((name) => /\.js\.html$/i.test(name));
  const sidebarFiles = unique(files.filter((name) => /sidebar/i.test(name)));
  const preferenceFiles = unique(files.filter((name) => /preferences?/i.test(name)));
  const scriptFiles = unique([...jsHtmlFiles, ...files.filter((name) => /\.m?js$/i.test(name))]);

  return {
    all: files,
    htmlFiles,
    jsHtmlFiles,
    scriptFiles,
    sidebarFiles,
    preferenceFiles
  };
}

function selectorRegex(selector) {
  if (selector.startsWith('#')) {
    const id = escapeRegExp(selector.slice(1));
    return new RegExp(`id=["']${id}["']`, 'g');
  }
  if (selector.startsWith('.')) {
    const cls = escapeRegExp(selector.slice(1));
    return new RegExp(`class=["'][^"']*\\b${cls}\\b[^"']*["']`, 'g');
  }
  if (selector.startsWith('[') || selector.includes('[')) {
    return new RegExp(escapeRegExp(selector), 'g');
  }
  return new RegExp(escapeRegExp(selector), 'g');
}

function countSelectorInFiles(selector, files) {
  const regex = selectorRegex(selector);
  return files.reduce((sum, file) => {
    const content = readFileIfExists(file);
    const matches = content.match(regex);
    return sum + (matches ? matches.length : 0);
  }, 0);
}

function checkIdentifierExists(identifier, files) {
  const re = new RegExp(`\\b${escapeRegExp(identifier)}\\b`);
  return files.some((file) => re.test(readFileIfExists(file)));
}

function countIdentifier(identifier, files) {
  const re = new RegExp(`\\b${escapeRegExp(identifier)}\\b`, 'g');
  return files.reduce((sum, file) => {
    const matches = readFileIfExists(file).match(re);
    return sum + (matches ? matches.length : 0);
  }, 0);
}

function checkBinding(binding, files) {
  const selectorFound = files.some((file) => readFileIfExists(file).includes(binding.selector));
  const eventsFound = (binding.events || []).every((eventName) =>
    files.some((file) => readFileIfExists(file).includes(eventName))
  );
  return selectorFound && eventsFound;
}

const repo = findRepoFiles();
const contract = loadJson(CONTRACT_PATH);

let failed = false;
let warned = false;

function fail(message) {
  console.error(`[FAIL] ${message}`);
  failed = true;
}

function warn(message) {
  console.warn(`[WARN] ${message}`);
  warned = true;
}

for (const item of contract.required_contract_snippets || []) {
  const file = item.file;
  const needle = item.must_include;
  if (!fileExists(file)) {
    fail(`missing file: ${file}`);
    continue;
  }
  if (!readFileIfExists(file).includes(needle)) {
    fail(`${file} missing contract text: ${needle}`);
  }
}

for (const name of contract.required_globals?.sidebar || []) {
  if (!checkIdentifierExists(name, repo.sidebarFiles.concat(repo.scriptFiles))) {
    fail(`missing required sidebar global/function: ${name}`);
  }
}

for (const name of contract.required_globals?.preferences || []) {
  if (!checkIdentifierExists(name, repo.preferenceFiles.concat(repo.scriptFiles))) {
    fail(`missing required preferences global/function: ${name}`);
  }
}

for (const binding of contract.required_bindings?.sidebar || []) {
  if (!checkBinding(binding, repo.sidebarFiles.concat(repo.scriptFiles))) {
    fail(`missing required sidebar binding: ${binding.selector} :: ${binding.events.join(',')}`);
  }
}

for (const binding of contract.required_bindings?.preferences || []) {
  if (!checkBinding(binding, repo.preferenceFiles.concat(repo.scriptFiles))) {
    fail(`missing required preferences binding: ${binding.selector} :: ${binding.events.join(',')}`);
  }
}

for (const key of contract.required_storage_keys?.sidebar_local_storage || []) {
  if (!repo.sidebarFiles.concat(repo.scriptFiles).some((file) => readFileIfExists(file).includes(key))) {
    fail(`missing required sidebar localStorage key: ${key}`);
  }
}

for (const key of contract.required_storage_keys?.preference_fields || []) {
  if (!repo.preferenceFiles.concat(repo.scriptFiles).some((file) => readFileIfExists(file).includes(key))) {
    fail(`missing required preference field/key: ${key}`);
  }
}

for (const pair of contract.required_behavior_pairs?.sidebar || []) {
  const files = repo.sidebarFiles.concat(repo.scriptFiles);
  if (!checkIdentifierExists(pair.writer, files) || !checkIdentifierExists(pair.reader, files)) {
    fail(`missing required sidebar behavior pair: ${pair.writer} -> ${pair.reader}`);
  }
}

for (const pair of contract.required_behavior_pairs?.preferences || []) {
  const files = repo.preferenceFiles.concat(repo.scriptFiles);
  if (!checkIdentifierExists(pair.writer, files) || !checkIdentifierExists(pair.reader, files)) {
    fail(`missing required preferences behavior pair: ${pair.writer} -> ${pair.reader}`);
  }
}

for (const name of contract.forbidden_globals?.sidebar || []) {
  if (checkIdentifierExists(name, repo.sidebarFiles.concat(repo.scriptFiles))) {
    fail(`forbidden sidebar global/function present: ${name}`);
  }
}

for (const name of contract.forbidden_globals?.preferences || []) {
  if (checkIdentifierExists(name, repo.preferenceFiles.concat(repo.scriptFiles))) {
    fail(`forbidden preferences global/function present: ${name}`);
  }
}

for (const identifier of contract.forbidden_identifiers?.sidebar || []) {
  if (repo.sidebarFiles.concat(repo.scriptFiles).some((file) => readFileIfExists(file).includes(identifier))) {
    fail(`forbidden sidebar identifier present: ${identifier}`);
  }
}

for (const identifier of contract.forbidden_identifiers?.preferences || []) {
  if (repo.preferenceFiles.concat(repo.scriptFiles).some((file) => readFileIfExists(file).includes(identifier))) {
    fail(`forbidden preferences identifier present: ${identifier}`);
  }
}

for (const identifier of contract.forbidden_identifiers?.global || []) {
  if (repo.all.some((file) => readFileIfExists(file).includes(identifier))) {
    fail(`forbidden global identifier present: ${identifier}`);
  }
}

for (const [selector, expectedCount] of Object.entries(contract.cardinality?.sidebar || {})) {
  const actual = countSelectorInFiles(selector, repo.sidebarFiles);
  if (actual !== expectedCount) {
    fail(`sidebar selector cardinality mismatch for ${selector}: expected ${expectedCount}, found ${actual}`);
  }
}

for (const [selector, expectedCount] of Object.entries(contract.cardinality?.preferences || {})) {
  const actual = countSelectorInFiles(selector, repo.preferenceFiles);
  if (actual !== expectedCount) {
    fail(`preferences selector cardinality mismatch for ${selector}: expected ${expectedCount}, found ${actual}`);
  }
}

for (const name of contract.warn_only?.sidebar_globals || []) {
  if (!checkIdentifierExists(name, repo.sidebarFiles.concat(repo.scriptFiles))) {
    warn(`missing warn-only sidebar global/function: ${name}`);
  }
}

for (const name of contract.warn_only?.preferences_globals || []) {
  if (!checkIdentifierExists(name, repo.preferenceFiles.concat(repo.scriptFiles))) {
    warn(`missing warn-only preferences global/function: ${name}`);
  }
}

if (failed) process.exit(1);
if (warned) console.log('[PASS with warnings] JS contracts look acceptable.');
else console.log('[PASS] JS contracts look correct.');
