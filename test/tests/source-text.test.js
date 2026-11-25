const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const source = read('apps-script/server/source-text.gs');
const client = read('apps-script/shared/source-text.html');
function load(body = source) {
  const context = vm.createContext({});
  vm.runInContext(body, context);
  return context;
}
const server = load();
const browser = load(client.replace(/^<script>\n/, '').replace(/<\/script>\n$/, ''));
const plain = (value) => JSON.parse(JSON.stringify(value));
const process = (html, opts) => plain(server.processSourceText_(html, opts));
const fixture = JSON.parse(read('test/tests/fixtures/commentary-editions.json'));
const sample = (name) => fixture.cases.find((entry) => entry.name === name);
const dataFor = (entry) => ({ ...entry, versionTitle: entry.version.versionTitle, translationVersion: entry.version });

test('the browser include is generated from the same complete server implementation', () => {
  assert.equal(client, '<script>\n' + source + '</script>\n', 'run node tools/sync-source-text.js');
});

test('only verified exact English editions and base corpora get commentary profiles', () => {
  for (const entry of fixture.cases) {
    const expected = entry.name.startsWith('silverstein-') ? 'bracketed' : entry.name === 'davidson-bold-base' ? 'bold-base' : 'none';
    assert.equal(server.sourceCommentaryProfile_(dataFor(entry)), expected, entry.name);
  }
  const davidson = dataFor(sample('davidson-bold-base'));
  for (const changed of [
    { versionTitle: davidson.versionTitle + ' ' },
    { categories: ['Tanakh', 'Torah'] },
    { categories: ['Talmud', 'Yerushalmi'] },
    { categories: ['Talmud', 'Commentary'] },
    { translationVersion: { ...davidson.translationVersion, actualLanguage: 'fr' } },
    { translationVersion: { versionTitle: davidson.versionTitle } },
  ]) assert.equal(server.sourceCommentaryProfile_({ ...davidson, ...changed }), 'none');
  const silverstein = dataFor(sample('silverstein-torah-brackets'));
  assert.equal(server.sourceCommentaryProfile_({ ...silverstein, indexTitle: 'Rashi on Genesis' }), 'none');
  assert.equal(server.sourceCommentaryProfile_({ ...silverstein, categories: ['Tanakh', 'Commentary', 'Torah'] }), 'none');
  const ketuvim = dataFor(sample('silverstein-ketuvim-brackets'));
  assert.equal(server.sourceCommentaryProfile_({ ...ketuvim, indexTitle: 'Commentary on Psalms' }), 'none');
  assert.equal(server.sourceCommentaryProfile_({ ...ketuvim, categories: ['Tanakh', 'Prophets'] }), 'none');
});

for (const mode of ['keep', 'discard', 'only']) {
  for (const notesMode of ['omit', 'inline', 'separate']) {
    test(`preview/server parity: ${mode} commentary and ${notesMode} notes on every captured edition`, () => {
      for (const entry of fixture.cases) {
        const opts = { commentaryMode: mode, notesMode, commentaryProfile: server.sourceCommentaryProfile_(dataFor(entry)) };
        assert.deepEqual(plain(browser.processSourceText_(entry.text, opts)), process(entry.text, opts), entry.name);
      }
    });
  }
}

test('JPS bold note quotation never qualifies the main translation for Drop', () => {
  const entry = sample('jps-semantic-note');
  for (const commentaryProfile of ['none', 'bold-base']) {
    for (const commentaryMode of ['keep', 'discard', 'only']) {
      const out = process(entry.text, { commentaryProfile, commentaryMode });
      assert.equal(out.text, 'When God began to create heaven and earth— ');
      assert.equal(out.hasNotes, true);
      assert.equal(out.hasCommentary, false);
      assert.equal(out.notes[0].label, 'a');
    }
  }
});

test('inline notes lose only their semantic outer wrapper, keeping inner bold and italics', () => {
  const out = process('A<sup class="footnote-marker">a</sup><i class="footnote"><b>lemma</b> and <i>nested <em>italics</em></i>.</i> B', { notesMode: 'inline' });
  assert.equal(out.text, 'A (lemma and nested italics.) B');
  assert.match(out.html, /<b>lemma<\/b>/);
  assert.match(out.html, /<i>nested italics<\/i>/);
  assert.ok(out.runs.some((run) => out.text.slice(run.start, run.end + 1) === ' and ' && !run.italic));
});

test('semantic footnotes tolerate class tokens, attribute order, quotes, case and nested markup', () => {
  const html = "main<SUP title='a > b' CLASS='extra footnote-marker'>a</SUP> \n<I lang='en' CLASS='other FOOTNOTE'><b>note <i>nested</i></b></I> continues";
  const out = process(html);
  assert.equal(out.text, 'main continues');
  assert.equal(out.notes[0].text, 'note nested');
  assert.equal(out.notes[0].label, 'a');
});

test('legacy unclassified superscript is a marker only beside a complete semantic note', () => {
  assert.equal(process('a<sup>1</sup><i class=footnote>note</i>b').text, 'ab');
  const out = process('x<sup>2</sup> + H<sub>2</sub>O after');
  assert.equal(out.text, 'x2 + H2O after');
  assert.equal(out.hasNotes, false);
  assert.equal(out.html, 'x<sup>2</sup> + H<sub>2</sub>O after');
  assert.deepEqual(out.runs.filter((run) => run.script !== 'normal').map((run) => run.script), ['sup', 'sub']);
});

test('standalone complete semantic notes get deterministic labels', () => {
  const out = process('a<i class=footnote>first</i>b<i class=footnote>second</i>', { notesMode: 'separate' });
  assert.equal(out.text, 'a[1]b[2]\n\nNotes\n[1] first\n[2] second');
});

test('separate notes disambiguate repeated source labels in passage order', () => {
  const html = ['one', 'two', 'three'].map((word) => word + '<sup class=footnote-marker>a</sup><i class=footnote>note ' + word + '</i>').join(' ');
  const out = process(html, { notesMode: 'separate' });
  assert.equal(out.text, 'one[a] two[a-2] three[a-3]\n\nNotes\n[a] note one\n[a-2] note two\n[a-3] note three');
  assert.deepEqual(out.notes.map((note) => note.label), ['a', 'a-2', 'a-3']);
  const unusual = process('a<sup>__proto__</sup><i class=footnote>one</i>b<sup>__proto__</sup><i class=footnote>two</i>', { notesMode: 'separate' });
  assert.deepEqual(unusual.notes.map((note) => note.label), ['__proto__', '__proto__-2']);
});

test('malformed notes and orphan markers never swallow the following text', () => {
  for (const html of [
    'Main<sup class=footnote-marker>a</sup><i class=footnote><b>lemma</b> trailing main text',
    'Main<sup class=footnote-marker>a</sup><i class=footnote><b>lemma</i> trailing main text',
    'Main<sup class=footnote-marker>a</sup> trailing main text',
    'Main<sup>a</sup> trailing main text',
  ]) {
    for (const commentaryMode of ['keep', 'discard', 'only']) {
      const out = process(html, { commentaryMode, commentaryProfile: 'bold-base' });
      assert.match(out.text, /^Maina/);
      assert.match(out.text, /trailing main text$/);
      assert.equal(out.hasNotes, false);
    }
  }
});

test('nested markup restores parent emphasis and handles unclosed ordinary emphasis safely', () => {
  const out = process('<b>outer <b>inner</b> outer</b> plain <i>open');
  assert.equal(out.html, '<b>outer inner outer</b> plain <i>open</i>');
});

test('ordinary inline-reference and overlay tags do not turn following text italic', () => {
  const out = process('before<i data-commentator="Rashi" data-order="1"></i> after <i data-overlay="Vilna Pages" data-value="2a"></i>end');
  assert.equal(out.text, 'before after end');
  assert.equal(out.runs.some((run) => run.italic), false);
});

test('source HTML becomes escaped text and known tags without executable attributes', () => {
  const out = process('<b onclick="bad()">&lt;img src=x&gt;</b><img src=x onerror=bad()><script>bad()</script><a href="javascript:bad()">link</a>');
  assert.equal(out.text, '<img src=x>link');
  assert.equal(out.html, '<b>&lt;img src=x&gt;</b>link');
});

test('entity decoding agrees with existing insert rules and uses UTF-16 run offsets', () => {
  const utils = load(read('apps-script/server/utils.gs'));
  for (const text of ['&thinsp;&amp;thinsp;&nbsp;&#160;&#x5D0;', '&amp;lt;b&amp;gt;', '&unknown; &mdash; &rlm;', '&#0;&#99999999;']) {
    assert.equal(process(text).text, utils.decodeHTMLEntities(text));
  }
  const out = process('x<b>😀</b>z');
  assert.deepEqual(out.runs[1], { start: 1, end: 2, bold: true, italic: false, script: 'normal' });
});

test('Talmud Drop preserves the original punctuation, heading and line-marker policy', () => {
  const prior = load(read('apps-script/server/insertion.gs'));
  const cases = [
    ['From when is the time that one may recite', [{ start: 0, end: 8 }, { start: 29, end: 41 }]],
    ['(1) First line here\n(2) no emphasis\n(3) Third', [{ start: 4, end: 8 }, { start: 40, end: 44 }]],
    ['Heading\nkept\nbold', [{ start: 13, end: 16 }], ['Heading']],
    ['  ', [{ start: 0, end: 1 }]],
    ['a, b — c', [{ start: 0, end: 0 }, { start: 7, end: 7 }]],
    ['wordsjoined', [{ start: 0, end: 4 }, { start: 8, end: 10 }]],
  ];
  for (const [text, runs, keepLines] of cases) assert.deepEqual(plain(server.sourceTextBoldOnlyEdits_(text, runs, keepLines)), plain(prior.planEmphasisOnlyEdits_(text, runs, keepLines)));
  assert.equal(process('Heading\n(1) <b>First</b> gloss\n(2) plain\n(3) <b>Third</b>.', {
    commentaryProfile: 'bold-base', commentaryMode: 'only', keepLines: ['Heading']
  }).text, 'Heading\n(1) First\n(3) Third.');
});

test('Talmud Combine removes bold, retains italic; no-bold passages stay whole in Drop', () => {
  assert.equal(process('<b>Base <i>word</i></b> <i>commentary</i>', { commentaryProfile: 'bold-base', commentaryMode: 'discard' }).html, 'Base <i>word</i> <i>commentary</i>');
  assert.equal(process('All <i>words</i> remain.', { commentaryProfile: 'bold-base', commentaryMode: 'only' }).html, 'All <i>words</i> remain.');
});

test('notes remain controlled by Notes even if their commentary anchor is dropped', () => {
  const html = '<b>Base</b> commentary<sup class=footnote-marker>a</sup><i class=footnote><b>Quoted</b> gloss</i> <b>end</b>';
  const out = process(html, { commentaryProfile: 'bold-base', commentaryMode: 'only', notesMode: 'separate' });
  assert.doesNotMatch(out.mainText, /commentary|Quoted/);
  assert.match(out.text, /\[a\]/);
  assert.match(out.text, /Notes\n\[a\] Quoted gloss/);
});

test('balanced and nested Silverstein commentary drops, including across style tags', () => {
  const out = process('One [a <i>nested [inner]</i> note] two', { commentaryProfile: 'bracketed', commentaryMode: 'only' });
  assert.equal(out.text, 'One two');
  assert.equal(process('one[a][b]two', { commentaryProfile: 'bracketed', commentaryMode: 'only' }).text, 'one two');
  const combined = process('One [<i>note [inner]</i>] two', { commentaryProfile: 'bracketed', commentaryMode: 'discard' });
  assert.equal(combined.html, 'One <i>note inner</i> two');
});

test('Silverstein italic base words survive; the JPS supplied translation is never removed', () => {
  const silverstein = sample('silverstein-italic-base');
  const out = process(silverstein.text, { commentaryProfile: 'bracketed', commentaryMode: 'only' });
  assert.match(out.html, /<i>kaporeth<\/i>/);
  assert.doesNotMatch(out.text, /itself/);
  const jps = sample('jps-supplied-translation');
  for (const mode of ['keep', 'discard', 'only']) assert.equal(process(jps.text, { commentaryMode: mode, commentaryProfile: server.sourceCommentaryProfile_(dataFor(jps)) }).text, jps.text);
});

test('real malformed Silverstein verses stay complete in both destructive modes', () => {
  for (const name of ['silverstein-malformed-open-bracket', 'silverstein-malformed-close-bracket']) {
    const entry = sample(name);
    for (const mode of ['discard', 'only']) {
      const out = process(entry.text, { commentaryProfile: 'bracketed', commentaryMode: mode });
      assert.equal(out.text, entry.text, name);
      assert.equal(out.preservedMalformedMarkup, true);
      assert.equal(server.transformSourceBrackets_(entry.text, mode).html, entry.text);
    }
  }
});

test('per-segment preparation preserves broken verses without pairing across verse boundaries', () => {
  const data = { ...dataFor(sample('silverstein-torah-brackets')), text: [['First [broken', 'Second] whole', '<i>Third</i> [note] whole']] };
  const original = JSON.stringify(data);
  const out = plain(server.prepareSourceCommentaryData_(data, 'only'));
  assert.deepEqual(out.text, [['First [broken', 'Second] whole', '<i>Third</i> whole']]);
  assert.equal(out.commentaryPrepared, true);
  assert.equal(out.commentaryMalformed, true);
  assert.equal(JSON.stringify(data), original, 'the raw preview/fetched data must remain reusable');
});

test('preparing brackets leaves semantic notes intact for all later Notes choices', () => {
  const data = { ...dataFor(sample('silverstein-torah-brackets')), text: 'Main [comment]<sup class="footnote-marker">a</sup><i class="footnote"><b>lemma [quoted]</b> note</i> tail' };
  const prepared = plain(server.prepareSourceCommentaryData_(data, 'only'));
  assert.match(prepared.text, /<sup class="footnote-marker">a<\/sup><i class="footnote">/);
  assert.doesNotMatch(prepared.text, /comment/);
  assert.equal(process(prepared.text).text, 'Main  tail');
  const inline = process(prepared.text, { notesMode: 'inline' });
  assert.match(inline.text, /lemma \[quoted\] note/);
  assert.equal(inline.hasNotes, true);
});

test('punctuation-off bracket entities are interpreted before final delimiter removal', () => {
  const html = 'Main &#91;comment&#93; tail';
  assert.equal(process(html, { commentaryProfile: 'bracketed', commentaryMode: 'only', stripBracketDelimiters: true }).text, 'Main tail');
  assert.equal(process(html, { commentaryProfile: 'bracketed', commentaryMode: 'keep', stripBracketDelimiters: true }).text, 'Main comment tail');
  assert.equal(process('Main [broken', { commentaryProfile: 'bracketed', commentaryMode: 'only', stripBracketDelimiters: true }).text, 'Main broken');
  assert.equal(process('Main<i class=footnote>A [quoted] word</i>', { notesMode: 'inline', stripBracketDelimiters: true }).text, 'Main (A quoted word)');
});

test('unknown modes or profiles never remove translation words and default to omitted notes', () => {
  const out = process('<b>Title</b> base [supplied]<sup>1</sup><i class=footnote>note</i>', { commentaryProfile: 'unknown', commentaryMode: 'delete', notesMode: 'unknown' });
  assert.equal(out.text, 'Title base [supplied]');
  assert.equal(out.html, '<b>Title</b> base [supplied]');
});

test('figure descriptions survive as escaped text without images or external requests', () => {
  const html = 'Before <b><img src="https://example.invalid/figure" alt="  Plan &amp; &lt;door&gt;  " onerror="bad()"></b> after<img src="https://example.invalid/empty">';
  const out = process(html);
  assert.equal(out.text, 'Before Plan & <door> after');
  assert.equal(out.html, 'Before <b>Plan &amp; &lt;door&gt;</b> after');
  assert.deepEqual(plain(browser.processSourceText_(html)), out);
});

test('figure descriptions inside semantic notes follow the selected Notes policy', () => {
  const html = 'Main<sup class="footnote-marker">1</sup><i class="footnote"><img alt="A figure caption" src="https://example.invalid/note"></i> text';
  assert.equal(process(html).text, 'Main text');
  assert.equal(process(html, { notesMode: 'inline' }).text, 'Main (A figure caption) text');
  const separate = process(html, { notesMode: 'separate' });
  assert.match(separate.text, /Notes\n\[1\] A figure caption$/);
  assert.doesNotMatch(separate.html, /<img|https:/);
});
