const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Every page the add-on opens carries the same Content-Security-Policy:
// images only from the hosts docs/PRIVACY.md §2.2 lists, no plugins, no
// <base> hijacking. Templates get it from shared/ui/head.html; dialogs served
// as plain files (createHtmlOutputFromFile, which cannot include()) carry a
// copy. This test finds every entry page and fails if one has no policy or a
// copy has drifted from the shared one.

const APPS_SCRIPT = path.resolve(__dirname, '../../apps-script');
const CSP = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/;

function entryPages() {
  // Entry pages are the .html files at the root of apps-script/ that open a
  // document; partials live in subfolders.
  return fs.readdirSync(APPS_SCRIPT)
    .filter((name) => name.endsWith('.html'))
    .filter((name) => /<html[\s>]/i.test(fs.readFileSync(path.join(APPS_SCRIPT, name), 'utf8')));
}

test('every entry page has the shared Content-Security-Policy', () => {
  const shared = fs.readFileSync(path.join(APPS_SCRIPT, 'shared/ui/head.html'), 'utf8').match(CSP);
  assert.ok(shared, 'shared/ui/head.html has no CSP meta tag');

  const pages = entryPages();
  assert.ok(pages.length >= 8, `expected the add-on's entry pages, found ${pages}`);

  pages.forEach((name) => {
    const html = fs.readFileSync(path.join(APPS_SCRIPT, name), 'utf8');
    if (html.includes("include('shared/ui/head')")) return;
    const own = html.match(CSP);
    assert.ok(own, `${name} has no Content-Security-Policy and does not include shared/ui/head`);
    assert.equal(own[1], shared[1], `${name}'s CSP differs from shared/ui/head.html`);
  });
});

test('the policy blocks plugins and base-URL changes and limits image hosts', () => {
  const shared = fs.readFileSync(path.join(APPS_SCRIPT, 'shared/ui/head.html'), 'utf8').match(CSP)[1];

  assert.match(shared, /object-src 'none'/);
  assert.match(shared, /base-uri 'self'/);
  assert.match(shared, /img-src 'self' data: /);
  assert.ok(!/img-src[^;]*\*(?!\.)/.test(shared), 'img-src must not allow every host');
});
