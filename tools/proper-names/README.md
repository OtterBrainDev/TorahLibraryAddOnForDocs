# Proper names

The Hebrew spellings of people, places and peoples that the transliteration
capitalizes (`apps-script/transliteration.gs`, `properNameStarts_`).

`generate.py` writes `apps-script/server/proper-names.gs` from:

- **The Tanakh:** STEPBible's TAHOT (Translators Amalgamated Hebrew OT), which
  splits every word of the Leningrad text into prefix and stem and tags each
  stem's part of speech. A stem tagged as the name of a person (`Npm`, `Npf`),
  a place (`Npl`) or a people (`Ng`) counts; divine titles (`Npt`) do not
  (the Name is read *HaShem*). Each spelling is measured: it is kept only if
  it is a name in at least 60% of its occurrences, pointed spellings and
  consonants separately, so אשר (Asher 29 times, "which" 4,807) is left out
  and עֵשָׂו (Esau) is kept while עָשׂוּ ("they did") is not. Two-word names
  whose first word is also a word (בֵּית אֵל, בְּאֵר שֶׁבַע) are a table of
  their own.
- **The Talmud:** `talmud-names.txt`, sages and places in consonants, written
  by hand: there is no tagged Talmud text to measure. A name that is also a
  word (מאיר, ששת) is marked to be capitalized only after a title (רבי, רבן,
  רב, מר, ר') or בן / בר, and the generator demotes any name the Tanakh uses
  20 or more times as a word (רבה, "great").

On the Tanakh itself the result finds 95% of the names in pointed text with
98.6% precision (unpointed: 89.5%, 97.1%). Most of what remains is a word
spelled exactly like a name (לָבָן Laban / "white").

Do not edit `proper-names.gs` by hand. To add a Talmud name, add it to
`talmud-names.txt` and re-run.

The data is © STEPBible.org, based on work at Tyndale House Cambridge,
CC BY 4.0. The credit is in the generated file's header and in Help →
About → Credits.

## Regenerating

```bash
# ~500 MB; only the TAHOT files are read.
git clone --depth 1 https://github.com/STEPBible/STEPBible-Data /tmp/stepbible
python3 tools/proper-names/generate.py /tmp/stepbible
python3 tools/proper-names/generate.py /tmp/stepbible --report   # the borderline spellings
npm test
```

Development tooling only: nothing in this folder is pushed to Apps Script, and
the add-on depends on no package.
