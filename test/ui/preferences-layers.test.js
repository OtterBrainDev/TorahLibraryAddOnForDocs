// Pins the stacking order of the Preferences dialog's layers.
//
// The tab bar is pinned (position: sticky) while the panel scrolls under it.
// An open section is its own stacking layer, high enough that its menus reach
// over the cards below it; at z-index 25 the bar went under an open section
// (30), so scrolled content painted over the tabs. The bar must sit above
// every layer that scrolls under it, and below the transient and modal
// layers that should cover it: an open custom select, the busy overlays and
// the dialogs.

const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const CSS = readAppScriptFile('preferences/css.html').replace(/\/\*[\s\S]*?\*\//g, '');

// The z-index of the rule whose selector list includes `selector` exactly.
function zIndexOf(css, selector) {
  for (const block of css.split('}')) {
    const [head, body] = block.split('{');
    if (!body) continue;
    const selectors = head.split(',').map((s) => s.trim());
    if (!selectors.includes(selector)) continue;
    const z = body.match(/z-index:\s*(\d+)/);
    if (z) return Number(z[1]);
  }
  throw new Error(`no z-index for ${selector}`);
}

test('the pinned tab bar paints over every section that scrolls under it', () => {
  const bar = zIndexOf(CSS, '.pref-tab-bar');
  assert.match(CSS, /\.pref-tab-bar \{\s*position: sticky;/);
  for (const scrolling of ['.section-accordion', '.section-accordion[open]', 'details.compact-accordion[open]']) {
    assert.ok(bar > zIndexOf(CSS, scrolling), `${scrolling} would paint over the tab bar`);
  }
});

test('an open menu, the overlays and the dialogs still cover the tab bar', () => {
  const bar = zIndexOf(CSS, '.pref-tab-bar');
  for (const above of ['.preferences-shell .custom-select.open', '.hide', '.modal-backdrop']) {
    assert.ok(zIndexOf(CSS, above) > bar, `${above} must stay above the tab bar`);
  }
  const busy = readAppScriptFile('shared/ui/busy-overlay.html').match(/z-index:\s*(\d+)/);
  assert.ok(Number(busy[1]) > bar, 'the busy overlay covers the tab bar');
});
