const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function readAppScriptFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readContract(relativePath) {
  return JSON.parse(readAppScriptFile(relativePath));
}

function selectorExists(html, selector) {
  if (selector.startsWith('#')) {
    const id = selector.slice(1);
    const idRegex = new RegExp(`\\bid\\s*=\\s*[\"']${escapeRegex(id)}[\"']`);
    return idRegex.test(html);
  }

  if (selector.startsWith('.')) {
    const klass = selector.slice(1);
    const classRegex = new RegExp(`\\bclass\\s*=\\s*[\"'][^\"']*\\b${escapeRegex(klass)}\\b[^\"']*[\"']`);
    return classRegex.test(html);
  }

  return html.includes(selector);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  ROOT,
  readAppScriptFile,
  readContract,
  selectorExists,
};
