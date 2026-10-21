"""Generate apps-script/server/proper-names.gs: the Hebrew spellings of people,
places and peoples the transliteration capitalizes (transliteration.gs).

Tanakh: every word STEPBible's TAHOT (Translators Amalgamated Hebrew OT, CC BY
4.0) tags as the name of a person, a place or a people. A spelling is kept
only when it is a name most of the time it occurs (SHARE): אשר is Asher 29
times and "which" thousands of times, so it is left out. Pointed spellings are
measured on their own, since the vowels often settle it (עֵשָׂו is Esau,
עָשׂוּ "they did").

Talmud: talmud-names.txt, sages and places, with no tagged text to measure
them by. See README.md.

    python3 tools/proper-names/generate.py <STEPBible-Data checkout> [--report]
"""
import collections
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(REPO, 'apps-script', 'server', 'proper-names.gs')
TALMUD = os.path.join(HERE, 'talmud-names.txt')

# Npm / Npf: a person; Npl: a place; Ng: a people (gentilic, "the Egyptian").
# Not Npt, a divine title (יהוה, אדני): transliteration.gs reads the Name
# HaShem, and אדני is also "my lords".
NAME_TAG = re.compile(r'^N(?:p[mfl]|g)')
# A spelling is a name if at least this share of its occurrences are.
SHARE = 0.6
# A pointed word the Tanakh never points that way falls back to its
# consonants only if they almost always are a name: שאול is Saul 90% of the
# time, but שְׁאוֹל is Sheol.
SURE = 0.95
LETTERS = re.compile(r'[\u05D0-\u05EA]')
# The vowel signs a pointed spelling is compared by. The same rule is
# pointedKey_ in transliteration.gs: qamats qatan and holam haser for vav
# read as qamats and holam; cantillation, meteg, rafe and the upper and lower
# dots are dropped; each letter's signs are sorted.
NIQQUD = re.compile(r'[\u05B0-\u05BC\u05C1\u05C2\u05C7]')
NIQQUD_SAME = {'\u05C7': '\u05B8', '\u05BA': '\u05B9'}
# A Talmud name the Tanakh uses this often as a word is capitalized only after
# a title: רבה is "great" or "much" 41 times. A rarer word (אשי, 9) is not
# worth losing the sage in every אמר רב אשי for.
COMMON_WORD = 20
# Prefixes a name takes in the text: and, the, in, as, to, from, that.
PREFIX_LETTERS = set('ובכלמשה')


def letters(text):
    return ''.join(LETTERS.findall(text))


def pointed_key(text):
    """The letters, each followed by its vowel signs in order; '' if it has none."""
    out = []
    marks = None
    for ch in text:
        if LETTERS.match(ch):
            if marks is not None:
                out.append(''.join(sorted(marks)))
            out.append(ch)
            marks = set()
        elif marks is not None and NIQQUD.match(ch):
            marks.add(NIQQUD_SAME.get(ch, ch))
    if marks is not None:
        out.append(''.join(sorted(marks)))
    key = ''.join(out)
    return key if key != letters(text) else ''


def read_tahot(root):
    """({consonants: entry}, {pointed: entry}); entry = {'name', 'other', 'prefix'}."""
    new = lambda: {'name': 0, 'other': 0, 'prefix': collections.Counter()}
    plain = collections.defaultdict(new)
    pointed = collections.defaultdict(new)
    # Two-word names whose first word is also a word (בֵּית אֵל, בְּאֵר שֶׁבַע),
    # keyed "first+second", pointed and not.
    pairs = collections.defaultdict(new)
    previous = None
    files = sorted(glob.glob(os.path.join(root, 'Translators Amalgamated OT+NT', 'TAHOT *.txt')))
    if len(files) != 4:
        sys.exit('expected the four TAHOT files under %s' % root)
    word = re.compile(r'^[0-9A-Za-z]+\.\d+\.\d+(?:\([0-9.]+\))?#\d+=([A-Z][^\t]*)$')
    for path in files:
        with open(path, encoding='utf-8-sig') as handle:
            for line in handle:
                cols = line.rstrip('\r\n').split('\t')
                match = word.match(cols[0]) if cols else None
                # The Leningrad text and the qere; not ketiv, LXX or restored words.
                if not match or match.group(1)[0] not in 'LQ' or len(cols) < 6:
                    if not match:
                        previous = None
                    continue
                hebrew = cols[1].split('\\')[0]
                spelling = letters(hebrew)
                if not spelling:
                    continue
                segments = hebrew.split('/')
                grammar = cols[5].split('\\')[0]
                tags = grammar[1:].split('/') if grammar[:1] in 'HA' else grammar.split('/')
                name_at = next((i for i, tag in enumerate(tags) if NAME_TAG.match(tag)), None)
                prefix = letters(''.join(segments[:name_at])) if name_at is not None else ''
                is_name = (name_at is not None and len(tags) == len(segments) and
                           all(ch in PREFIX_LETTERS for ch in prefix))
                entries = [plain[spelling]]
                key = pointed_key(hebrew.replace('/', ''))
                if key:
                    entries.append(pointed[key])
                for entry in entries:
                    if is_name:
                        entry['name'] += 1
                        entry['prefix'][len(prefix)] += 1
                    else:
                        entry['other'] += 1
                verse = cols[0].split('#')[0]
                if previous and previous['verse'] == verse:
                    both = previous['is_name'] and is_name
                    for first, second in ((previous['spelling'], spelling), (previous['key'], key)):
                        if first and second:
                            entry = pairs[first + '+' + second]
                            if both:
                                entry['name'] += 1
                                entry['prefix'][previous['prefix']] += 1
                            else:
                                entry['other'] += 1
                previous = {'verse': verse, 'spelling': spelling, 'key': key, 'is_name': is_name,
                            'prefix': len(prefix) if is_name else 0}
    return plain, pointed, pairs


def kept(table, share):
    """{spelling: prefix letters} for the spellings that are a name at least `share` of the time."""
    out = {}
    for spelling, entry in table.items():
        if entry['name'] and entry['name'] >= share * (entry['name'] + entry['other']):
            out[spelling] = entry['prefix'].most_common(1)[0][0]
    return out


def read_talmud():
    """{consonants: 'name' | 'titled'}; a line ending in * is 'titled'."""
    out = {}
    with open(TALMUD, encoding='utf-8') as handle:
        for raw in handle:
            line = raw.split('#')[0].strip()
            if not line:
                continue
            titled = line.endswith('*')
            for spelling in line.rstrip('*').split():
                out[letters(spelling)] = 'titled' if titled else 'name'
    return out


def report(plain, pointed):
    """The borderline: names that are also words, most frequent first."""
    for label, table, share in (('unpointed', plain, SHARE), ('pointed', pointed, SHARE)):
        print('== %s' % label)
        rows = [(s, e['name'], e['other']) for s, e in table.items() if e['name'] and e['other']]
        rows.sort(key=lambda r: -(r[1] + r[2]))
        for spelling, name, other in rows[:300]:
            share_of = name / (name + other)
            print('%s\t%d\t%d\t%.2f\t%s' % (spelling, name, other, share_of, 'kept' if share_of >= share else 'left out'))


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    plain, pointed, pairs = read_tahot(argv[1])
    if '--report' in argv:
        report(plain, pointed)
        return

    names = kept(plain, SHARE)
    sure = kept(plain, SURE)
    pointed_names = kept(pointed, SHARE)

    # Only the pairs the single words do not already catch: the first word
    # alone is not kept.
    def first_missed(pair):
        first = pair.split('+')[0]
        return first not in names and first not in pointed_names
    name_pairs = {k: v for k, v in kept(pairs, SHARE).items() if first_missed(k) and pairs[k]['name'] >= 2}
    talmud = []
    titled = []
    for spelling, kind in sorted(read_talmud().items()):
        if spelling in sure:
            continue
        entry = plain.get(spelling)
        if kind == 'name' and entry and entry['other'] >= COMMON_WORD and spelling not in names:
            # The Tanakh uses this spelling often as a word.
            print('title only: %s (in the Tanakh a name %d times, a word %d)' % (spelling, entry['name'], entry['other']))
            kind = 'titled'
        (talmud if kind == 'name' else titled).append(spelling)

    # Space-separated strings, split on first use: cheaper for Apps Script to
    # parse on every execution than object literals of ~20,000 keys.
    def packed(table):
        return ' '.join(s + str(p) for s, p in sorted(table.items()))

    lines = [
        '// Generated by tools/proper-names/generate.py. Do not edit; re-run the generator.',
        '// The Hebrew spellings of people, places and peoples that the transliteration',
        '// capitalizes (transliteration.gs: markProperNames_).',
        '// Tanakh: STEPBible.org TAHOT, based on work at Tyndale House Cambridge,',
        '// CC BY 4.0 (https://github.com/STEPBible/STEPBible-Data). A spelling that is a',
        '// name in fewer than %d%% of its occurrences is left out. Talmud:' % round(SHARE * 100),
        '// tools/proper-names/talmud-names.txt.',
        '//',
        '// A word is a spelling and the number of prefix letters before the name',
        '// (ומשה1: "and Moshe").',
        '// PROPER_NAMES_POINTED_: pointed spellings (pointedKey_), looked up first for a',
        '//   pointed word: עֵשָׂו is Esau, עָשׂוּ "they did".',
        '// PROPER_NAMES_: consonants, for unpointed text.',
        '// PROPER_NAMES_SURE_: the consonants that are a name %d%% of the time or more:' % round(SURE * 100),
        '//   the fallback for a pointed word whose pointing the Tanakh does not have.',
        '// PROPER_NAMES_PAIRS_: two-word names whose first word is also a word,',
        '//   "first+second", pointed and not (בֵּית+אֵל0: Beit El).',
        '// PROPER_NAMES_TALMUD_: sages and places, consonants, after up to two prefix',
        '//   letters (דרבא); PROPER_NAMES_AFTER_TITLE_: those capitalized only after a title',
        "//   (רבי, רבן, רב, מר, ר') or בן / בר, because they are also ordinary words.",
        'var PROPER_NAMES_POINTED_ = %s;' % json.dumps(packed(pointed_names), ensure_ascii=False),
        'var PROPER_NAMES_ = %s;' % json.dumps(packed(names), ensure_ascii=False),
        'var PROPER_NAMES_SURE_ = %s;' % json.dumps(' '.join(sorted(sure)), ensure_ascii=False),
        'var PROPER_NAMES_PAIRS_ = %s;' % json.dumps(packed(name_pairs), ensure_ascii=False),
        'var PROPER_NAMES_TALMUD_ = %s;' % json.dumps(' '.join(talmud), ensure_ascii=False),
        'var PROPER_NAMES_AFTER_TITLE_ = %s;' % json.dumps(' '.join(titled), ensure_ascii=False),
        '',
    ]
    with open(OUT, 'w', encoding='utf-8') as handle:
        handle.write('\n'.join(lines))
    print('Tanakh: %d pointed, %d unpointed (%d sure), %d pairs; Talmud: %d, %d after a title only -> %s (%d KB)' % (
        len(pointed_names), len(names), len(sure), len(name_pairs), len(talmud), len(titled),
        os.path.relpath(OUT, REPO), os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main(sys.argv)
