// Pins where "Name the edition" lives in Preferences: a row under each
// title's "Link title to Sefaria" in the Insertion card (Source: "Name the
// edition in the title"; Translation: "Name the translation in the title"),
// shown while that title is linked. The two switches used to sit inside each
// title's font editor, opened only from the Title font button, where nobody
// found them.

const test = require('node:test');
const assert = require('node:assert/strict');

const { readAppScriptFile } = require('./test-utils');

const MARKUP = readAppScriptFile('shared/composition-card/markup.html');
const CARD = readAppScriptFile('shared/composition-card/shared.html');
const PREFS = readAppScriptFile('preferences.html');
const PREFS_JS = readAppScriptFile('preferences/js.html');
const SIDEBAR = readAppScriptFile('sidebar.html');
const LINKER = readAppScriptFile('linker-results.html');

const ROWS = [
  { row: 'cc-he-edition-toggle', link: 'cc-he-title-toggle', input: 'hebrew_link_edition_label', key: 'hebrewEdition', state: 'hebrewEditionOn', linkState: 'hebrewLinkOn' },
  { row: 'cc-edition-toggle', link: 'cc-title-toggle', input: 'sefaria_link_edition_label', key: 'edition', state: 'editionOn', linkState: 'linkOn' },
];

test('each title has its edition row right under its link switch', () => {
  ROWS.forEach(({ row, link }) => {
    const linkAt = MARKUP.indexOf(`id="${link}"`);
    const rowAt = MARKUP.indexOf(`id="${row}"`);
    assert.ok(linkAt > 0 && rowAt > linkAt, `${row} follows ${link}`);
    const between = MARKUP.slice(linkAt, rowAt);
    assert.equal((between.match(/class="cc-row[ "]/g) || []).length, 1, `nothing between ${link} and ${row}`);
    assert.match(MARKUP, new RegExp(`id="${row}" data-cc-feature="editionLabel"`));
  });
});

test('only Preferences shows the rows: it alone saves the switches', () => {
  assert.match(PREFS, /data-cc-features="[^"]*\beditionLabel\b/);
  [SIDEBAR, LINKER].forEach((page) => {
    const features = page.match(/data-cc-features="([^"]*)"/)[1];
    assert.ok(!/editionLabel/.test(features), features);
  });
});

test('the switches are the card\'s state inputs, never inside a font editor', () => {
  const inputs = PREFS.match(/<div class="composition-state-inputs" hidden>[\s\S]*?\n                <\/div>/)[0];
  ROWS.forEach(({ input }) => {
    assert.match(inputs, new RegExp(`<input id="${input}" type="checkbox" name="${input}">`));
    assert.equal(PREFS.split(`id="${input}"`).length - 1, 1, `${input} appears once`);
  });
  const count = (html) => (html.match(/edition_label/g) || []).length;
  assert.equal(count(PREFS), count(inputs), 'an edition switch outside the card\'s state inputs (a font editor?)');
});

test('the card draws each row from its state and hides it while the title is unlinked', () => {
  ROWS.forEach(({ row, key, state, linkState, input }) => {
    assert.match(CARD, new RegExp(`ccSetToggle\\(\\$\\('#${row}'\\), state\\.${state} !== false\\)`));
    assert.match(CARD, new RegExp(`\\$\\('#${row}'\\)\\.prop\\('hidden', !state\\.${linkState}\\)`));
    assert.match(CARD, new RegExp(`\\$\\('#${row}'\\)\\.off\\('click\\.cc'\\)\\.on\\('click\\.cc', function \\(\\) \\{ doToggle\\('${key}'\\); \\}\\)`));
    assert.match(PREFS_JS, new RegExp(`${state}: \\w+ \\? \\w+\\.checked : true`));
    assert.ok(PREFS_JS.includes(`'${input}'`), `Preferences flips ${input}`);
  });
});
