#!/usr/bin/env node
// Copy the pure Apps Script processor into an ordinary client include.
// This is not a runtime dependency: both shipped files are plain JavaScript.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'apps-script/server/source-text.gs'), 'utf8');
const output = '<script>\n' + source + '</script>\n';
fs.writeFileSync(path.join(root, 'apps-script/shared/source-text.html'), output);
console.log('Updated apps-script/shared/source-text.html from server/source-text.gs.');
