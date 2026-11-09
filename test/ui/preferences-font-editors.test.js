// Preferences has no Fonts tab. Each font is edited in one place, the
// Insertion tab, beside the setting it styles: a font button in the card (or
// Layout's Citation style) opens that font's full editor in place — font,
// size, style, colours, preview, and for a title its linked style — instead of
// the small font-and-size panel the sidebar and Link Texts keep. The settings
// the Fonts tab held twice (transliteration scheme, Bold & italics) have only
// the card's control. See shared/composition-card (fontEditor).
const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const PREFS = readAppScriptFile('preferences.html');
const PREFS_JS = readAppScriptFile('preferences/js.html');
const CARD_MARKUP = readAppScriptFile('shared/composition-card/markup.html');
const CARD_JS = readAppScriptFile('shared/composition-card/shared.html');

// Font button role → the preference prefixes its editor holds.
const EDITORS = {
  hebrew: ['hebrew'],
  translation: ['translation'],
  hebrewTitle: ['hebrew_title', 'hebrew_link'],
  translationTitle: ['source_title', 'sefaria_link'],
  transliteration: ['transliteration'],
  citation: ['citation'],
};

function editorBlock(role) {
  const start = PREFS.indexOf(`data-font-editor="${role}"`);
  assert.ok(start >= 0, `no editor for ${role}`);
  const next = PREFS.indexOf('data-font-editor="', start + 1);
  const end = PREFS.indexOf('</div>\n                </div>', start);
  return PREFS.slice(start, next > 0 ? Math.min(next, end > 0 ? end : next) : end);
}

test('Preferences has no Fonts tab; Insertion is the first tab and open', () => {
  assert.doesNotMatch(PREFS, /pref-tab-fonts|data-pref-tab="fonts"/);
  assert.doesNotMatch(PREFS_JS, /pref-tab-fonts|showTitleLanguage|onMoreFontSettings/);
  const first = PREFS.match(/<button type="button" id="(pref-tab-[a-z]+-btn)"[^>]*aria-selected="(true|false)"/);
  assert.deepEqual([first[1], first[2]], ['pref-tab-insertion-btn', 'true']);
  assert.match(PREFS, /<div class="pref-tab-panel" id="pref-tab-insertion" role="tabpanel" aria-labelledby="pref-tab-insertion-btn">/);
});

test('every font button has exactly one full editor, with every field of its font', () => {
  const roles = new Set([...(CARD_MARKUP + PREFS).matchAll(/class="cc-font-chip"[^>]*data-font-role="([A-Za-z]+)"/g)].map((m) => m[1]));
  assert.deepEqual([...roles].sort(), Object.keys(EDITORS).sort());
  for (const [role, prefixes] of Object.entries(EDITORS)) {
    assert.equal(PREFS.split(`data-font-editor="${role}"`).length, 2, `${role}: one editor`);
    const block = editorBlock(role);
    for (const prefix of prefixes) {
      for (const suffix of ['_font', '_font_size', '_font_style', '_font_color', '_font_background']) {
        assert.match(block, new RegExp(`name="${prefix}${suffix}"`), `${role}: ${prefix}${suffix}`);
      }
    }
  }
  // The card turns the transliteration's button on in Preferences only.
  assert.match(PREFS, /data-cc-features="[^"]*\btranslitFont\b/);
  for (const host of ['sidebar.html', 'linker-results.html']) {
    assert.doesNotMatch(readAppScriptFile(host), /data-cc-features="[^"]*\btranslitFont\b/, host);
  }
});

test('Preferences opens the editors in place; the sidebar and Link Texts keep the font panel', () => {
  assert.match(PREFS_JS, /fontEditor: function \(role\) \{\s*return document\.querySelector\('\[data-font-editor="' \+ role \+ '"\]'\);/);
  assert.doesNotMatch(readAppScriptFile('sidebar/js/composition-controls.html'), /fontEditor:/);
  assert.doesNotMatch(readAppScriptFile('linker-results.html'), /fontEditor:/);
  // A button with an editor toggles it; any other opens the panel.
  assert.match(CARD_JS, /if \(ccHasInlineFontEditor\(role\)\) \{[\s\S]*?ccOpenInlineFontEditor\(role\);[\s\S]*?return;\s*\}\s*if \(_ccFontPanelRole === role\)/);
  // The editor is moved, never copied: one copy of each named field.
  assert.match(CARD_JS, /slot\.appendChild\(editor\);/);
  assert.doesNotMatch(CARD_JS, /cloneNode/);
});

test('settings the Fonts tab duplicated have only the card\'s control', () => {
  // Transliteration scheme: the card's Style. Bold & italics: the card's.
  assert.match(PREFS, /<div class="composition-state-inputs" hidden>[\s\S]*?id="transliteration_scheme"[\s\S]*?id="source_emphasis_mode"[\s\S]*?<\/div>/);
  assert.doesNotMatch(PREFS_JS, /'select#transliteration_scheme'/);
  assert.doesNotMatch(PREFS, /data-pref-group="source_emphasis_mode"/);
  // Placed beside what they belong to.
  assert.match(PREFS, /data-cc-attach="translationLanguage"[\s\S]*?id="preferred_translation_language"/);
  assert.match(PREFS, /id="emphasis-mapping" data-cc-attach="emphasisMapping"/);
  assert.match(PREFS, /<label class="cc-row-label" for="source_title_heading">Title style<\/label>/);
});
