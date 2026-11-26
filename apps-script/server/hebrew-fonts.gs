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
  var result = { font: font, size: size };
  if (surrounding && surrounding.hebrewContext) result.hebrewContext = true;
  return result;
}


// Measured from regular Google Fonts glyph outlines; see docs/hebrew-auto-scale.md.
// Keep the preview mirror in shared/fonts/js.html in sync.
var HEBREW_AUTO_SCALE_ = {
  "Alef": 1.163,
  "Arimo": 1.015,
  "Assistant": 1.044,
  "Bellefair": 1.158,
  "Bona Nova": 1,
  "Cardo": 1,
  "David Libre": 1.013,
  "Frank Ruhl Libre": 1,
  "Heebo": 1.077,
  "IBM Plex Sans Hebrew": 1.002,
  "Miriam Libre": 1.089,
  "Noto Rashi Hebrew": 1,
  "Noto Sans Hebrew": 1.063,
  "Noto Serif Hebrew": 1,
  "Open Sans": 1,
  "Rubik": 1.068,
  "Secular One": 1.109,
  "Suez One": 1.032,
  "Tinos": 1,
  "Varela Round": 1.025
};

function hebrewAutoScaleFactor_(font) {
  var name = String(font || '').trim().toLowerCase();
  var key = Object.keys(HEBREW_AUTO_SCALE_).find(function (family) { return family.toLowerCase() === name; });
  return key ? HEBREW_AUTO_SCALE_[key] : 1;
}

// Only called for a Hebrew role with both font and size set to match.
// Do not enlarge already-Hebrew context (including repeated insertions).
function applyMatchedHebrewScale_(role, surrounding) {
  if (surrounding && surrounding.hebrewContext) return;
  var font = role.font;
  var size = role.size;
  if (!font || !size) {
    try {
      var normal = DocumentApp.getActiveDocument().getBody().getHeadingAttributes(DocumentApp.ParagraphHeading.NORMAL);
      font = font || normal[DocumentApp.Attribute.FONT_FAMILY];
      size = size || Number(normal[DocumentApp.Attribute.FONT_SIZE]);
    } catch (error) { return; }
  }
  var factor = hebrewAutoScaleFactor_(font);
  if (factor <= 1 || !(size > 0) || size > 400) return;
  var scaled = Math.min(400, Math.max(size, Math.round(size * factor * 10) / 10));
  if (scaled > size) {
    role.font = font;
    role.size = scaled;
  }
}
