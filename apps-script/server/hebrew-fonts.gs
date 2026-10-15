// Hebrew marks a font has no glyph for, and borrowing them from Noto.
//
// Many Hebrew fonts have the letters and the vowels but no cantillation marks
// (David Libre, Frank Ruhl Libre, Heebo, Alef: see hebrew-font-coverage.gs).
// Docs then draws each missing mark as an empty box, or in whatever font the
// reader's computer falls back to. Only the marks the font lacks are set in
// the Noto Hebrew of the same kind (serif or sans), which has all of them; the
// letters, and every mark the font does have, stay in the reader's font. A
// mark the font has is never moved: a mark in another font than its letter is
// positioned by that font's defaults, not anchored to the letter, which is
// close for Noto's marks but not exact.
//
// Fonts not in the table (Arial, Times New Roman, any font without Hebrew) are
// left alone: what Docs draws for them is not known here.
//
// The client mirror (preview) is shared/fonts/js.html; keep the two alike.

var HEBREW_MARK_LENDERS_ = {
  serif: 'Noto Serif Hebrew',
  sans: 'Noto Sans Hebrew'
};

var hebrewFontGapsCache_ = {};

/** '0591-05AF,05BD' -> [[0x591, 0x5AF], [0x5BD, 0x5BD]] */
function parseCodepointRanges_(spec) {
  return String(spec || '').split(',').filter(Boolean).map(function (part) {
    var ends = part.split('-');
    var start = parseInt(ends[0], 16);
    return [start, ends.length > 1 ? parseInt(ends[1], 16) : start];
  });
}

function hebrewCoverageEntry_(font) {
  var name = String(font || '').trim().toLowerCase();
  if (!name) return null;
  var names = Object.keys(HEBREW_FONT_COVERAGE_);
  for (var i = 0; i < names.length; i++) {
    if (names[i].toLowerCase() === name) return HEBREW_FONT_COVERAGE_[names[i]];
  }
  return null;
}

/**
 * The marks `font` lacks and the font that lends them, or null when it lacks
 * none or is not a font we have measured.
 * @returns {?{lender: string, ranges: Array<Array<number>>}}
 */
function hebrewFontMarkGaps_(font) {
  var key = String(font || '').trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(hebrewFontGapsCache_, key)) return hebrewFontGapsCache_[key];
  var entry = hebrewCoverageEntry_(key);
  var gaps = (entry && entry.missing)
    ? { lender: HEBREW_MARK_LENDERS_[entry.style] || HEBREW_MARK_LENDERS_.serif, ranges: parseCodepointRanges_(entry.missing) }
    : null;
  hebrewFontGapsCache_[key] = gaps;
  return gaps;
}

function fontLacksCodepoint_(gaps, codepoint) {
  for (var i = 0; i < gaps.ranges.length; i++) {
    if (codepoint >= gaps.ranges[i][0] && codepoint <= gaps.ranges[i][1]) return true;
  }
  return false;
}

/**
 * Which characters of `text` to set in a lending font. Pure.
 *
 * @param {string} text
 * @param {string} baseFont  the font the text is in ("" = unknown: nothing)
 * @param {Array<{start: number, end: number, font: string}>} [fontRuns]
 *        stretches set in another font (an emphasis mapped to a font), end
 *        inclusive; later runs win
 * @returns {Array<{start: number, end: number, font: string}>} end inclusive;
 *        neighbouring marks lent by the same font are one range
 */
function planHebrewMarkFallback_(text, baseFont, fontRuns) {
  var source = String(text || '');
  var runs = Array.isArray(fontRuns) ? fontRuns.filter(function (run) { return run && run.font; }) : [];
  var plan = [];
  if (!/[֑-ׇ׳״]/.test(source)) return plan;
  for (var i = 0; i < source.length; i++) {
    var codepoint = source.charCodeAt(i);
    if (!((codepoint >= 0x0591 && codepoint <= 0x05C7) || codepoint === 0x05F3 || codepoint === 0x05F4)) continue;
    var font = baseFont;
    for (var r = runs.length - 1; r >= 0; r--) {
      if (i >= runs[r].start && i <= runs[r].end) { font = runs[r].font; break; }
    }
    var gaps = hebrewFontMarkGaps_(font);
    if (!gaps || !fontLacksCodepoint_(gaps, codepoint)) continue;
    var last = plan[plan.length - 1];
    if (last && last.end === i - 1 && last.font === gaps.lender) {
      last.end = i;
    } else {
      plan.push({ start: i, end: i, font: gaps.lender });
    }
  }
  return plan;
}

/** Sets each planned range in its lending font. `text` is a Docs Text. */
function applyHebrewMarkFallback_(text, plan) {
  for (var i = 0; i < plan.length; i++) {
    text.setFontFamily(plan[i].start, plan[i].end, plan[i].font);
  }
}

/**
 * The font of the document's Normal text style: what text with no font of its
 * own is drawn in. Docs' own default is Arial.
 */
function readDocumentBaseFont_() {
  try {
    var attributes = DocumentApp.getActiveDocument().getBody()
      .getHeadingAttributes(DocumentApp.ParagraphHeading.NORMAL);
    var font = attributes && attributes[DocumentApp.Attribute.FONT_FAMILY];
    return font ? String(font) : 'Arial';
  } catch (error) {
    return '';
  }
}

/**
 * For the sidebar's "Match the document" font preview: the font and size at
 * the cursor, or the Normal text style's when the text there has none of its
 * own. Nothing from the document but those two values leaves the server.
 * @returns {{font: string, size: ?number}}
 */
function getInsertionPointFont() {
  var surrounding = null;
  try {
    surrounding = readSurroundingTextStyle_();
  } catch (error) {
    surrounding = null;
  }
  var font = surrounding && surrounding.font ? String(surrounding.font) : readDocumentBaseFont_();
  var size = surrounding && Number(surrounding.size) > 0 ? Number(surrounding.size) : null;
  return { font: font, size: size };
}
