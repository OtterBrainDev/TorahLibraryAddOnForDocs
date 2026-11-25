#!/usr/bin/env node
// Opt-in, read-only live contract check. No Google account or document is used.
// Run: node tools/check-sefaria-v3.js [case-name-substring]
// Node 22+ and Python 3 (standard library only). Kept out of npm test so the
// deterministic suite does not depend on network access or Sefaria uptime.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const cache = {};
const requests = [];
const results = [];
const pythonFetch = [
  'import json,sys,urllib.request,urllib.error',
  'try:',
  ' r=urllib.request.urlopen(sys.argv[1],timeout=35)',
  ' print(json.dumps({"status":r.status,"body":r.read().decode("utf-8")}))',
  'except urllib.error.HTTPError as e:',
  ' print(json.dumps({"status":e.code,"body":e.read().decode("utf-8")}))',
].join('\n');

function fetchResponse(url) {
  const parsed = new URL(url);
  assert.equal(parsed.origin, 'https://www.sefaria.org');
  assert.match(parsed.pathname, /^\/api\/(ref\/|v3\/texts\/|texts\/versions\/)/);
  const started = Date.now();
  const response = JSON.parse(execFileSync('python3', ['-c', pythonFetch, url], {
    encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024,
  }));
  requests.push({ path: parsed.pathname, status: response.status, ms: Date.now() - started });
  return { getResponseCode: () => response.status, getContentText: () => response.body };
}

const ctx = {
  console, Logger: { log() {} },
  Utilities: {
    DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algorithm, value) => Array.from(crypto.createHash(algorithm).update(value).digest()),
    base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
  },
  UrlFetchApp: { fetch: fetchResponse },
  PropertiesService: { getUserProperties: () => ({ getProperties: () => ({}), getProperty: () => null }) },
  CacheService: { getUserCache: () => ({ get: (key) => cache[key] || null, put: (key, value) => { cache[key] = value; } }) },
};
vm.createContext(ctx);
for (const file of ['preferences', 'source-text', 'text-processing', 'citation-abbreviations', 'sefaria-fetch']) {
  const name = 'apps-script/server/' + file + '.gs';
  vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), ctx, { filename: name });
}
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/gematriya.gs'), 'utf8'), ctx);

function check(name, run) {
  if (process.argv[2] && !name.includes(process.argv[2])) return;
  const before = requests.length;
  try {
    const detail = run();
    const result = { name, status: 'PASS', requests: requests.length - before, ...detail };
    results.push(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    results.push({ name, status: 'FAIL', requests: requests.length - before, message: error.message });
    console.error(JSON.stringify(results[results.length - 1]));
    process.exitCode = 1;
  }
}

const sourceTitle = 'Miqra according to the Masorah';
check('bilingual segment and complete catalog', () => {
  const d = ctx.findReference('Genesis 1:1');
  assert.equal(d.ref, 'Genesis 1:1');
  assert.ok(ctx.versionHasText_(d.he) && ctx.versionHasText_(d.text));
  assert.ok(d.versions.length > 2);
  return { ref: d.ref, translation: d.versionTitle, source: d.heVersionTitle, catalog: d.versions.length };
});
for (const [language, title] of [
  ['French', 'Bible du Rabbinat 1899 [fr]'],
  ['Yiddish', "Yehoyesh's Yiddish Tanakh Translation [yi]"],
]) {
  check('exact ' + language + ' edition', () => {
    const d = ctx.findReference('Genesis 1:1', { en: title, he: sourceTitle });
    assert.equal(d.versionTitle, title);
    assert.equal(d.heVersionTitle, sourceTitle);
    assert.ok(ctx.versionHasText_(d.text));
    return { ref: d.ref, language: d.actualLanguage, translation: d.versionTitle };
  });
}
check('exact alternate source edition', () => {
  const d = ctx.findReference('Genesis 1:1', { he: 'Tanach with Text Only' });
  assert.equal(d.heVersionTitle, 'Tanach with Text Only');
  assert.ok(ctx.versionHasText_(d.he) && ctx.versionHasText_(d.text));
  return { ref: d.ref, source: d.heVersionTitle };
});
check('literal edition-title whitespace', () => {
  const title = 'The Philosophical Tanakh ';
  const d = ctx.findReference('Genesis 1:1', { en: title, he: sourceTitle });
  assert.equal(d.versionTitle, title);
  assert.ok(ctx.versionHasText_(d.text));
  return { ref: d.ref, translation: d.versionTitle };
});
check('spanning range and formatted chapter boundaries', () => {
  const d = ctx.findReference('Genesis 1:31-2:1');
  assert.equal(d.ref, 'Genesis 1:31-2:1');
  assert.equal(d.isSpanning, true);
  assert.ok(Array.isArray(d.he[0]) && Array.isArray(d.text[0]));
  const formatted = ctx.formatDataForPesukim(d, true);
  assert.match(formatted.text, /\(31\)/);
  assert.match(formatted.text, /Chapter 2\n\(1\)/);
  return { ref: d.ref, headings: Array.from(d.sectionHeadingLines) };
});
for (const [requested, expected] of [
  ['Obadiah', 'Obadiah 1'],
  ['Sefer HaChinukh', 'Sefer HaChinukh 1'],
  ['Rashi on Genesis 1', 'Rashi on Genesis 1:1'],
  ['Berakhot 2a:1', 'Berakhot 2a:1'],
]) {
  check('bounded reference: ' + requested, () => {
    const d = ctx.findReference(requested);
    assert.equal(d.ref, expected);
    assert.ok(ctx.versionHasText_(d.he) || ctx.versionHasText_(d.text));
    return { requested, ref: d.ref };
  });
}
check('structural heading without arbitrary chapter', () => {
  const before = requests.length;
  const d = ctx.findReference('Pesach Haggadah');
  assert.equal(d.ref, 'Pesach Haggadah');
  assert.equal(ctx.versionHasText_(d.he) || ctx.versionHasText_(d.text), false);
  assert.equal(requests.slice(before).some((r) => r.path.includes('/v3/texts/')), false);
  return { ref: d.ref };
});
check('missing exact edition does not substitute', () => {
  const d = ctx.findReference('Genesis 1:1', { en: 'No such edition migration test', he: sourceTitle });
  assert.equal(d.versionTitle, '');
  assert.equal(ctx.versionHasText_(d.text), false);
  assert.equal(d.heVersionTitle, sourceTitle);
  return { ref: d.ref, warnings: d.warnings.length };
});
check('per-passage availability for every language family', () => {
  const available = ctx.getTranslationAvailability('Genesis 1:1');
  assert.ok(available && Object.keys(available.versions).length > 2);
  assert.equal(available.versions['Bible du Rabbinat 1899 [fr]'], true);
  const before = requests.length;
  assert.ok(ctx.getTranslationAvailability('Genesis 1:1'));
  assert.equal(requests.length, before);
  return { ref: available.ref, editions: Object.keys(available.versions).length };
});
check('display preferences retain pointed transliteration source', () => {
  const d = ctx.findReferenceWithPreferences_('Genesis 1:1', { nekudot: 'false', teamim: 'false' });
  assert.doesNotMatch(d.he, /[\u0591-\u05BD]/);
  assert.match(d.heTransliterationSource, /[\u0591-\u05BD]/);
  return { ref: d.ref };
});

// A–D: verify edition metadata and annotation policy through the live reader.
function sourceOutput(data, mode, notesMode) {
  const prepared = ctx.prepareSourceCommentaryData_(data, mode);
  const formatted = ctx.formatDataForPesukim(Object.assign({}, prepared), false);
  return ctx.processSourceText_(formatted.text, {
    commentaryMode: mode,
    commentaryProfile: prepared.commentaryPrepared ? 'none' : ctx.sourceCommentaryProfile_(prepared),
    notesMode: notesMode || 'omit',
    stripBracketDelimiters: !!prepared.commentaryPunctuationStripped,
  });
}
const silverstein = 'The Rashi chumash by Rabbi Shraga Silverstein';
const jps = 'THE JPS TANAKH: Gender-Sensitive Edition';
check('commentary: Silverstein Torah brackets and punctuation', () => {
  const d = ctx.findReference('Genesis 1:1', { en: silverstein });
  assert.equal(ctx.sourceCommentaryProfile_(d), 'bracketed');
  const dropped = sourceOutput(d, 'only');
  assert.match(dropped.text, /of the heavens and the earth/);
  assert.doesNotMatch(dropped.text, /attribute of justice/);
  const combined = sourceOutput(d, 'discard');
  assert.match(combined.text, /attribute of justice/);
  assert.doesNotMatch(combined.text, /[\[\]]/);
  const stripped = ctx.applyPunctuationPreferences(d, { getProperty: (key) => key === 'translation_punctuation' ? 'false' : null });
  const noPunctuation = sourceOutput(stripped, 'only');
  assert.doesNotMatch(noPunctuation.text, /attribute of justice|[\[\]]/);
  return { ref: d.ref, profile: ctx.sourceCommentaryProfile_(d) };
});
check('commentary: Silverstein malformed verse stays whole', () => {
  const d = ctx.findReference('Genesis 49:17', { en: silverstein });
  const prepared = ctx.prepareSourceCommentaryData_(d, 'only');
  assert.equal(prepared.commentaryMalformed, true);
  assert.equal(sourceOutput(d, 'only').text, sourceOutput(d, 'keep').text);
  return { ref: d.ref, preservedMalformedSegment: true };
});
check('commentary: Silverstein Ketuvim brackets', () => {
  const d = ctx.findReference('Psalms 1:1', { en: 'The Rashi Ketuvim by Rabbi Shraga Silverstein' });
  assert.equal(ctx.sourceCommentaryProfile_(d), 'bracketed');
  assert.ok(sourceOutput(d, 'keep').text.length > sourceOutput(d, 'only').text.length);
  return { ref: d.ref, profile: ctx.sourceCommentaryProfile_(d) };
});
check('commentary: JPS semantic notes independent of Drop', () => {
  const d = ctx.findReference('Genesis 1:1', { en: jps });
  assert.equal(ctx.sourceCommentaryProfile_(d), 'none');
  const omit = sourceOutput(d, 'only', 'omit');
  const inline = sourceOutput(d, 'only', 'inline');
  const separate = sourceOutput(d, 'only', 'separate');
  assert.equal(omit.hasNotes, true);
  assert.match(omit.text, /When God began to create/);
  assert.equal(omit.text, sourceOutput(d, 'keep', 'omit').text);
  assert.ok(inline.text.length > omit.text.length);
  assert.match(separate.text, /Notes/);
  return { ref: d.ref, notes: omit.notes.length, unknownProfilePreservesWords: true };
});
check('commentary: JPS supplied bracket words are translation', () => {
  const d = ctx.findReference('Genesis 1:30', { en: jps });
  assert.match(sourceOutput(d, 'only').text, /\[I give\]/);
  return { ref: d.ref, suppliedWordsPreserved: true };
});
check('commentary: Davidson bold base and explanation', () => {
  const d = ctx.findReference('Berakhot 2a:1', { en: 'William Davidson Edition - English' });
  assert.equal(ctx.sourceCommentaryProfile_(d), 'bold-base');
  assert.ok(sourceOutput(d, 'keep').text.length > sourceOutput(d, 'only').text.length);
  assert.equal(sourceOutput(d, 'keep').text, sourceOutput(d, 'discard').text);
  return { ref: d.ref, profile: ctx.sourceCommentaryProfile_(d) };
});

console.log(JSON.stringify({
  observedAt: new Date().toISOString(), passed: results.filter((r) => r.status === 'PASS').length,
  failed: results.filter((r) => r.status === 'FAIL').length, httpRequests: requests.length,
  environment: 'Local production .gs functions + live Sefaria; no Google Docs deployment',
}));
