const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSourceInsertion } = require('./helpers/source-insertion-harness');

const SILVERSTEIN = 'The Rashi chumash by Rabbi Shraga Silverstein';
const DAVIDSON = 'William Davidson Edition - English';
const JPS = 'THE JPS TANAKH: Gender-Sensitive Edition';
const note = (label, text) => '<sup data-x="1" class="footnote-marker">' + label + '</sup><i lang="en" class="footnote">' + text + '</i>';
const exact = (title, text, extra = {}) => ({
  ref: 'Genesis 1:1-2', heRef: 'בראשית א׳:א׳-ב׳', indexTitle: 'Genesis', categories: ['Tanakh', 'Torah'],
  versionTitle: title, actualLanguage: 'en', translationVersion: { versionTitle: title, actualLanguage: 'en', languageFamilyName: 'english' },
  heVersionTitle: 'Source', sections: [1, 1], he: ['אחד', 'שנים'], text, ...extra,
});
const jps = () => exact(JPS, [
  'First [supplied words]' + note('a', '<b>First</b> a quoted note') + ' after.',
  'Second <b>emphasis</b> remains.'
], { he: ['אחד' + note('א', '<b>ראשון</b> הערה') + ' סוף', 'שנים'] });
const opts = (extra = {}) => ({ pasukPreference: false, sourceEmphasisMode: 'only', ...extra });
const flat = (env) => env.texts().join('\n');

for (const mode of ['omit', 'inline', 'separate']) {
  test('unprofiled JPS Drop keeps the complete translation with Notes ' + mode + ' in single-language insertion', () => {
    const env = loadSourceInsertion();
    env.ctx.insertReference(jps(), opts({ singleLanguage: 'en', sourceNotesMode: mode }));
    const inserted = env.texts()[1];
    assert.ok(inserted.includes('First [supplied words]'), inserted);
    assert.ok(inserted.includes(' after. Second emphasis remains.'), inserted);
    assert.equal(inserted.includes('a quoted note'), mode !== 'omit');
    assert.equal(inserted.includes('\n\nNotes\n[a] First a quoted note'), mode === 'separate');
    if (mode === 'inline') assert.ok(inserted.includes(' (First a quoted note) after.'), inserted);
  });
}

test('source-only insertion applies Notes independently of translation Commentary', () => {
  for (const mode of ['omit', 'inline', 'separate']) {
    const env = loadSourceInsertion();
    env.ctx.insertReference(jps(), opts({ singleLanguage: 'he', sourceNotesMode: mode }));
    const inserted = env.texts()[1];
    assert.ok(inserted.includes('אחד') && inserted.includes('סוף שנים'), inserted);
    assert.equal(inserted.includes('ראשון הערה'), mode !== 'omit');
    if (mode === 'separate') assert.ok(inserted.includes('Notes\n[א] ראשון הערה'), inserted);
    assert.ok(!flat(env).includes('First'), 'unused translation is not inserted');
  }
});

test('Stacked and both table directions keep base text and place separate notes with their own language', () => {
  for (const layout of ['he-top', 'he-right', 'he-left']) {
    const env = loadSourceInsertion();
    env.ctx.insertReference(jps(), opts({ bilingualLayout: layout, sourceNotesMode: 'separate' }));
    const english = env.paragraphs().find((p) => p._state.text.startsWith('First [supplied words]'));
    const hebrew = env.paragraphs().find((p) => p._state.text.startsWith('אחד'));
    assert.ok(english && hebrew, layout);
    assert.ok(english._state.text.includes('Second emphasis remains.'), layout);
    assert.ok(english._state.text.endsWith('[a] First a quoted note'), layout);
    assert.ok(hebrew._state.text.endsWith('[א] ראשון הערה'), layout);
    assert.equal(english._state.ltr, true); assert.equal(hebrew._state.ltr, false);
    if (layout !== 'he-top') {
      const row = env.tables[0].texts()[1];
      assert.ok(row[layout === 'he-left' ? 0 : 1].startsWith('אחד'), layout + ': source column');
    }
  }
});

test('aligned Stacked and table layouts attach notes to the correct verse without re-filtering bold notes', () => {
  for (const layout of ['he-top', 'he-right', 'he-left']) {
    const env = loadSourceInsertion();
    env.ctx.insertReference(jps(), opts({ bilingualLayout: layout, alignedRows: true, pasukPreference: true, sourceNotesMode: 'separate' }));
    const english = env.paragraphs().map((p) => p._state.text).filter((text) => /^\([12]\)/.test(text));
    assert.deepEqual(english, ['(1) First [supplied words][a] after.\n\nNotes\n[a] First a quoted note', '(2) Second emphasis remains.'], layout);
    const hebrew = env.paragraphs().map((p) => p._state.text).filter((text) => /^\([אב]\)/.test(text));
    assert.deepEqual(hebrew, ['(א) אחד[א] סוף\n\nNotes\n[א] ראשון הערה', '(ב) שנים'], layout);
  }
});

test('Silverstein Drop and Combine process each verse independently, preserving a malformed verse and base italics', () => {
  for (const mode of ['only', 'discard']) {
    for (const alignedRows of [false, true]) {
      const env = loadSourceInsertion();
      const data = exact(SILVERSTEIN, ['Broken [unclosed explanation', '<i>Next</i> [separate explanation] verse.']);
      env.ctx.insertReference(data, { bilingualLayout: 'he-top', alignedRows, pasukPreference: true, sourceEmphasisMode: mode });
      const all = flat(env);
      assert.ok(all.includes('Broken [unclosed explanation'), all);
      assert.equal(all.includes('separate explanation'), mode === 'discard');
      assert.ok(all.includes(mode === 'only' ? 'Next verse.' : 'Next separate explanation verse.'), all);
      const next = env.paragraphs().find((p) => p._state.text.includes('Next'));
      const index = next._state.text.indexOf('Next');
      assert.equal(next._state.chars[index].italic, true, 'base-text italics survives processing and typography');
    }
  }
});

test('Punctuation Off preserves recognized bracket semantics until Silverstein Drop or Combine runs', () => {
  for (const mode of ['only', 'discard']) {
    const env = loadSourceInsertion({ preferences: { translation_punctuation: 'false' } });
    const raw = exact(SILVERSTEIN, ['Opening, [commentary!] final.', 'Second [another explanation] verse.']);
    const fetched = env.ctx.applyPunctuationPreferences(raw, env.props);
    env.ctx.insertReference(fetched, opts({ singleLanguage: 'en', sourceEmphasisMode: mode }));
    assert.equal(env.texts()[1], mode === 'only'
      ? 'Opening final Second verse'
      : 'Opening commentary final Second another explanation verse');
  }
});

test('Davidson Drop keeps bold base text while an inline or separate note never triggers a second Drop', () => {
  for (const mode of ['inline', 'separate']) {
    const env = loadSourceInsertion();
    const data = exact(DAVIDSON, ['<b>Base words</b>' + note('1', '<b>Quoted</b> explanatory note') + ' surrounding commentary <b>continue.</b>'],
      { ref: 'Berakhot 2a:1', indexTitle: 'Berakhot', categories: ['Talmud', 'Bavli'], he: ['משנה'] });
    env.ctx.insertReference(data, opts({ singleLanguage: 'en', sourceNotesMode: mode }));
    const inserted = env.texts()[1];
    assert.ok(inserted.includes('Base words') && inserted.includes('continue.'), inserted);
    assert.ok(inserted.includes('Quoted explanatory note'), inserted);
    assert.ok(!inserted.includes('surrounding commentary'), inserted);
    const main = env.paragraphs()[1]._state;
    assert.equal(main.chars[0].bold, true);
    const noteIndex = main.text.indexOf('explanatory note');
    assert.equal(main.chars[noteIndex].bold, false, 'note body is retained without forcing it bold');
  }
});

test('multi-version insertion uses each edition profile and preserves one source Notes block', () => {
  for (const arrangement of ['en', 'he-top', 'aligned']) {
    const one = exact(SILVERSTEIN, ['Alpha [Rashi explanation]' + note('a', '<b>Alpha</b> Rashi note'), 'Next [more Rashi] line']);
    const two = exact(JPS, ['Alpha [supplied words]' + note('a', '<b>Alpha</b> JPS note'), 'Next <b>bold word</b> line']);
    one.he = two.he = ['אחד' + note('א', 'הערה'), 'שנים'];
    const env = loadSourceInsertion({ versions: { [SILVERSTEIN]: one, [JPS]: two } });
    const result = env.ctx.insertReferenceVersions('Genesis 1:1-2', opts({
      versionTitles: [SILVERSTEIN, JPS], heVersionTitle: 'Source', sourceNotesMode: 'separate',
      ...(arrangement === 'en' ? { singleLanguage: 'en' } : { bilingualLayout: 'he-top', alignedRows: arrangement === 'aligned' }),
    }));
    assert.deepEqual(Array.from(result.inserted), [SILVERSTEIN, JPS]);
    const all = flat(env);
    assert.ok(!all.includes('Rashi explanation') && !all.includes('more Rashi'), arrangement + ': recognized comments dropped');
    assert.ok(all.includes('[supplied words]') && all.includes('Next bold word line'), arrangement + ': JPS text retained');
    assert.ok(all.includes('Alpha Rashi note') && all.includes('Alpha JPS note'), arrangement + ': both notes retained');
    assert.equal((all.match(/\[א\] הערה/g) || []).length, arrangement === 'en' ? 0 : 1, arrangement + ': source note occurs once');
  }
});

test('ordinary superscript and subscript survive Notes Omit and document typography', () => {
  const env = loadSourceInsertion();
  env.ctx.insertReference(exact(JPS, ['x<sup>2</sup> + H<sub>2</sub>O ' + note('a', 'remove this annotation') + 'tail']),
    opts({ singleLanguage: 'en', sourceNotesMode: 'omit' }));
  const main = env.paragraphs()[1]._state;
  assert.equal(main.text, 'x2 + H2O tail');
  assert.equal(main.chars[1].script, 'SUPERSCRIPT');
  assert.equal(main.chars[6].script, 'SUBSCRIPT');
  assert.ok(main.chars.slice(8).every((ch) => ch.script === 'NORMAL'));
});
