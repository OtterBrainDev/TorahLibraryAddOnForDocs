# Hebrew font coverage

Which Hebrew vowel, cantillation and punctuation marks each Google Font with
Hebrew has a glyph for. The add-on borrows the missing ones from Noto Serif /
Sans Hebrew at insert time (`apps-script/server/hebrew-fonts.gs`), and the
preview does the same (`apps-script/shared/fonts/js.html`).

`generate.py` reads the font files themselves and writes:

- `apps-script/server/hebrew-font-coverage.gs` (the insert)
- `apps-script/shared/fonts/coverage.html` (the preview)

Both come from the same run; `test/tests/hebrew-fonts.test.js` checks that they
agree. Do not edit them by hand.

Development tooling only: nothing in this folder is pushed to Apps Script, and
the add-on depends on no package.

## Regenerating

Re-run it when Google Fonts adds or updates a Hebrew family, or to add a font
to the pickers (`FONT_PICKER_HEBREW` in `shared/fonts/js.html`).

```bash
# Only the METADATA files and the Hebrew families' font files (~150 MB).
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/google/fonts.git /tmp/gfonts
cd /tmp/gfonts
git sparse-checkout set --no-cone '/*/*/METADATA.pb'
git checkout
git sparse-checkout add $(grep -l 'subsets: "hebrew"' */*/METADATA.pb | xargs -n1 dirname | sed 's|^|/|; s|$|/*.ttf|')
git checkout
cd -

python3 -m venv /tmp/fontvenv && /tmp/fontvenv/bin/pip install fonttools
/tmp/fontvenv/bin/python tools/hebrew-font-coverage/generate.py /tmp/gfonts
npm test
```

It stops if Noto Serif Hebrew or Noto Sans Hebrew ever lacks a mark, since
they lend them.
