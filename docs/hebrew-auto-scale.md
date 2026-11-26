# Hebrew optical auto-scale — initial calibration

The Insertion preference **Auto-Scale Hebrew** is off by default and appears only when Hebrew uses Match the document and a blank size. The Hebrew body role alone is enlarged, never the translation, title or an explicitly configured font/size. Already-Hebrew context and unknown fonts are unchanged. The estimate is rounded to 0.1 pt and limited to 400 pt. No fonts are shipped.

## Method and evidence

Measured 2026-11-26 from upright regular/default-axis TrueType outlines in [google/fonts](https://github.com/google/fonts). Normalize the glyph yMax relative to unitsPerEm; use the median of ordinary Hebrew consonants (excluding final forms and lamed); target the mean of Latin x and H yMax. Use max(1, min(1.3, target/median)), rounded to three decimals. This is a conservative, enlargement-only design heuristic, not an optical test of the Docs renderer. Arial, Calibri, Crimson Text, EB Garamond, Georgia, Roboto, Times New Roman, Verdana and legacy/non-Docs names are unmeasured for Hebrew in Docs: do not guess a factor (1.0). The font files are not embedded. The default axes of variable fonts may not match Docs' exact variants.

| Family | Factor | At 12 pt |
|---|---:|---:|
| Alef | 1.163 | 14.0 |
| Arimo | 1.015 | 12.2 |
| Assistant | 1.044 | 12.5 |
| Bellefair | 1.158 | 13.9 |
| Bona Nova | 1.000 | 12.0 |
| Cardo | 1.000 | 12.0 |
| David Libre | 1.013 | 12.2 |
| Frank Ruhl Libre | 1.000 | 12.0 |
| Heebo | 1.077 | 12.9 |
| IBM Plex Sans Hebrew | 1.002 | 12.0 |
| Miriam Libre | 1.089 | 13.1 |
| Noto Rashi Hebrew | 1.000 | 12.0 |
| Noto Sans Hebrew | 1.063 | 12.8 |
| Noto Serif Hebrew | 1.000 | 12.0 |
| Open Sans | 1.000 | 12.0 |
| Rubik | 1.068 | 12.8 |
| Secular One | 1.109 | 13.3 |
| Suez One | 1.032 | 12.4 |
| Tinos | 1.000 | 12.0 |
| Varela Round | 1.025 | 12.3 |

## Verification still required

Run npm test and live Docs insertion on known fonts (Alef, Bellefair, Heebo, Noto Serif Hebrew), unknown fonts, repeated Hebrew insertion, explicit font/size, account/document/named profile switches, imports, reset, stacked and aligned layouts. Check niqqud and cantillation visually and confirm Preview follows the matched font. Do not deploy until review.
