const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { readAppScriptFile, ROOT } = require('./test-utils');

let parseHTML;
try { ({ parseHTML } = require('linkedom')); } catch (_) { /* npm ci enables DOM checks. */ }
const needsDom = { skip: !parseHTML };

function expand(name) {
  return readAppScriptFile(name + '.html').replace(/<\?!=\s*include\('([^']+)'\)\s*;?\s*\?>/g,
    (_, partial) => expand(partial)).replace(/<\?[^>]*\?>/g, '');
}

const entryPages = fs.readdirSync(path.join(ROOT, 'apps-script'))
  .filter((name) => name.endsWith('.html')).map((name) => name.slice(0, -5));

test('editor add-on pages have a language, title, landmark, and resolvable accessibility references', needsDom, () => {
  for (const name of entryPages) {
    const { document } = parseHTML(expand(name));
    assert.equal(document.documentElement.getAttribute('lang'), 'en', name);
    assert.ok(document.title.trim(), name);
    assert.equal(document.querySelectorAll('main').length, 1, name);
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    assert.equal(ids.length, new Set(ids).size, name + ' has duplicate IDs');
    for (const attribute of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']) {
      for (const element of document.querySelectorAll('[' + attribute + ']')) {
        for (const id of element.getAttribute(attribute).trim().split(/\s+/)) {
          assert.ok(document.getElementById(id), name + ' ' + attribute + ' points to ' + id);
        }
      }
    }
  }
});

test('Help and Preferences tablists contain tabs associated with their named panels', needsDom, () => {
  for (const name of ['help-modal', 'preferences']) {
    const { document } = parseHTML(expand(name));
    for (const list of document.querySelectorAll('[role="tablist"]')) {
      for (const tab of list.children) {
        assert.equal(tab.getAttribute('role'), 'tab', name + ': ' + tab.textContent);
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        assert.equal(panel.getAttribute('role'), 'tabpanel', tab.id);
        assert.equal(panel.getAttribute('aria-labelledby'), tab.id);
      }
    }
  }
});

test('sidebar search modes expose one selected radio and the notice and status each have their own accessible target', needsDom, () => {
  const { document } = parseHTML(expand('sidebar'));
  const modes = [...document.querySelectorAll('.mode-switch-section [role="radio"]')];
  assert.equal(modes.length, 4);
  assert.deepEqual(modes.filter((mode) => mode.getAttribute('aria-checked') === 'true')
    .map((mode) => mode.getAttribute('data-sidebar-mode')), ['texts']);
  assert.ok(modes.filter((mode) => mode.getAttribute('aria-checked') === 'false')
    .every((mode) => mode.getAttribute('tabindex') === '-1'));
  const notice = document.querySelector('#sidebar-notice [role="alertdialog"]');
  assert.equal(notice.getAttribute('aria-describedby'), 'sidebar-notice-message');
  const status = document.getElementById('sidebar-toast-status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.hasAttribute('hidden'), false);
});
