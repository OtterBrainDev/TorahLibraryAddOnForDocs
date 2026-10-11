// Insertion module: inserting resolved references into Google Docs.
// Handles layout modes (bilingual, single-language), typography application,
// transliteration rendering, and rich-text HTML-to-Docs conversion.
// All functions called from menu.gs or client-side insertReference handlers.

/**
 * Read the emphasis (bold / italic) runs already present in a text element.
 *
 * Uses getTextAttributeIndices() rather than probing every character: it
 * returns only the offsets where formatting changes, so a passage with three
 * bolded phrases costs a handful of Apps Script calls instead of one per
 * character. Only runs that actually carry emphasis are returned — the absence
 * of emphasis is not something we need to restore.
 */
function captureEmphasisRuns_(text, length) {
  const runs = [];
  if (!text || !(length > 0)) {
    return runs;
  }

  let boundaries;
  try {
    boundaries = text.getTextAttributeIndices() || [];
  } catch (error) {
    return runs;
  }

  if (boundaries.indexOf(0) < 0) {
    boundaries = [0].concat(boundaries);
  }

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = (i + 1 < boundaries.length ? boundaries[i + 1] : length) - 1;
    if (!(start >= 0) || end < start || end >= length) {
      continue;
    }
    let bold = false;
    let italic = false;
    try {
      bold = text.isBold(start) === true;
      italic = text.isItalic(start) === true;
    } catch (error) {
      continue;
    }
    if (bold || italic) {
      runs.push({ start: start, end: end, bold: bold, italic: italic });
    }
  }

  return runs;
}

// Line separators inside one inserted paragraph: insertRichTextFromHTML writes
// "\n" for <br> and formatDataForPesukim for each verse; Docs may report a
// soft break as \r or \u000b.
const EMPHASIS_ONLY_LINE_BREAK_ = /[\n\r\u000b]/;
// The "(3) " / "(ג) " marker formatDataForPesukim puts at the start of a line.
// It is ours, not the source's, so it is kept on any line that keeps words.
const EMPHASIS_ONLY_LINE_MARKER_ = /^[ \t]*\([^)\n\r\u000b]*\)[ \t]*/;
const EMPHASIS_ONLY_WORD_CHAR_ = /[\p{L}\p{N}]/u;
const EMPHASIS_ONLY_SPACE_ = /[ \t\u00a0]/;

/**
 * Plan the edits for "keep only the source's bold and italics": delete the
 * text the source did not emphasize, keep what it did. Pure, so the rules are
 * tested in Node (test/tests/source-emphasis-mode.test.js); applyTextEdits_
 * carries the plan out on a Docs Text element.
 *
 * Per line of the paragraph:
 *   - a line with no emphasis at all is removed, with one line break;
 *     blank lines are left alone;
 *   - otherwise the line marker is kept, and every run of unemphasized text
 *     containing a letter or digit is removed. Between two kept runs it
 *     becomes a single space, so the words don't join; before the first or
 *     after the last kept run it simply goes. Unemphasized runs of only
 *     spaces and punctuation (", ", " — ") are kept.
 * A paragraph with no emphasis anywhere is left whole: there is nothing to
 * choose by, and removing it (the Hebrew Gemara has no bold) would lose the
 * text rather than filter it.
 *
 * @param {string} fullText
 * @param {Array<{start: number, end: number}>} runs  Emphasized ranges, end
 *        inclusive (captureEmphasisRuns_).
 * @return {Array<{start: number, end: number, insert: string}>} Edits in
 *         descending order, so applying each leaves earlier offsets valid.
 *         `end < start` means insert only.
 */
function planEmphasisOnlyEdits_(fullText, runs) {
  const text = String(fullText || '');
  const n = text.length;
  if (!n || !Array.isArray(runs) || !runs.length) return [];

  // A bolded bare space is markup noise, not emphasis: it must not make a
  // line count as emphasized.
  const keep = new Array(n).fill(false);
  let kept = 0;
  runs.forEach(function (run) {
    const from = Math.max(0, run.start);
    const to = Math.min(n - 1, run.end);
    if (!text.slice(from, to + 1).trim()) return;
    for (let i = from; i <= to; i++) keep[i] = true;
    kept++;
  });
  if (!kept) return [];

  const edits = [];
  const hasWordChar = function (from, to) {
    return EMPHASIS_ONLY_WORD_CHAR_.test(text.slice(from, to + 1));
  };

  // Split into lines; a line with words but no emphasis is removed.
  const lines = [];
  let lineStart = 0;
  while (lineStart <= n) {
    let lineEnd = lineStart; // exclusive
    while (lineEnd < n && !EMPHASIS_ONLY_LINE_BREAK_.test(text[lineEnd])) lineEnd++;
    let emphasized = false;
    for (let i = lineStart; i < lineEnd; i++) {
      if (keep[i]) { emphasized = true; break; }
    }
    lines.push({
      start: lineStart,
      end: lineEnd,
      emphasized: emphasized,
      removed: !emphasized && text.slice(lineStart, lineEnd).trim() !== ''
    });
    lineStart = lineEnd + 1;
  }

  // Each run of removed lines goes with one line break: the one after it, or
  // at the end of the paragraph the one before it.
  for (let l = 0; l < lines.length; l++) {
    if (!lines[l].removed) continue;
    const first = l;
    while (l + 1 < lines.length && lines[l + 1].removed) l++;
    if (l + 1 < lines.length) {
      edits.push({ start: lines[first].start, end: lines[l + 1].start - 1, insert: '' });
    } else {
      edits.push({ start: Math.max(0, lines[first].start - 1), end: lines[l].end - 1, insert: '' });
    }
  }

  lines.forEach(function (line) {
    if (!line.emphasized) return;
    const lineEnd = line.end;
    const marker = EMPHASIS_ONLY_LINE_MARKER_.exec(text.slice(line.start, lineEnd));
    const contentStart = line.start + (marker ? marker[0].length : 0);
    let i = contentStart;
    while (i < lineEnd) {
      if (keep[i]) { i++; continue; }
      const gapStart = i;
      while (i < lineEnd && !keep[i]) i++;
      const gapEnd = i - 1;
      if (!hasWordChar(gapStart, gapEnd)) continue;

      const interior = gapStart > contentStart && gapEnd < lineEnd - 1;
      const spacedAlready = interior &&
        (EMPHASIS_ONLY_SPACE_.test(text[gapStart - 1]) || EMPHASIS_ONLY_SPACE_.test(text[gapEnd + 1]));
      if (!interior || spacedAlready) {
        edits.push({ start: gapStart, end: gapEnd, insert: '' });
        continue;
      }
      // Keep one of the gap's own spaces rather than inserting one, so the
      // separator doesn't inherit the emphasis of the run before it.
      let space = -1;
      for (let k = gapStart; k <= gapEnd; k++) {
        if (EMPHASIS_ONLY_SPACE_.test(text[k])) { space = k; break; }
      }
      if (space < 0) {
        edits.push({ start: gapStart, end: gapEnd, insert: ' ' });
      } else {
        if (space < gapEnd) edits.push({ start: space + 1, end: gapEnd, insert: '' });
        if (space > gapStart) edits.push({ start: gapStart, end: space - 1, insert: '' });
      }
    }
  });

  // Ranges never overlap: removed lines and gaps inside kept lines are
  // disjoint, and the blocks above are maximal.
  return edits.sort(function (a, b) { return b.start - a.start; });
}

/** Carry out planEmphasisOnlyEdits_ on a Docs Text element. */
function applyTextEdits_(text, edits) {
  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    if (edit.end >= edit.start) text.deleteText(edit.start, edit.end);
    if (edit.insert) text.insertText(edit.start, edit.insert);
  }
}

/**
 * Apply one emphasis mapping to a range. Only ever turns formatting ON, so the
 * baseline style applied across the paragraph still governs everywhere the
 * source said nothing.
 */
function applyEmphasisMapping_(text, start, end, mapping) {
  if (!mapping || end < start) {
    return;
  }

  const flags = String(mapping.style || '')
    .split(',')
    .map(function (flag) { return flag.trim().toLowerCase(); })
    .filter(Boolean);

  if (flags.indexOf('bold') >= 0) text.setBold(start, end, true);
  if (flags.indexOf('italic') >= 0) text.setItalic(start, end, true);
  if (flags.indexOf('underline') >= 0) text.setUnderline(start, end, true);

  if (mapping.color) text.setForegroundColor(start, end, mapping.color);
  if (mapping.background) text.setBackgroundColor(start, end, mapping.background);
  if (mapping.font) text.setFontFamily(start, end, mapping.font);
}

/**
 * Apply the user's font family / size / style / colour to a whole paragraph.
 *
 * @param {Paragraph} paragraph
 * @param {string} font
 * @param {number} size
 * @param {string} style               Comma-separated flags, or "normal".
 * @param {Object} [opts]
 * @param {string} [opts.color]        Foreground colour, "#rrggbb". Omitted or
 *                                     null leaves the existing colour alone.
 * @param {string} [opts.background]   Background colour, same convention.
 * @param {boolean} [opts.preserveSourceEmphasis=false]
 *        Opt in for paragraphs whose text came from Sefaria markup. The style
 *        flags are applied as the BASELINE across the paragraph, then the
 *        bold/italic runs the source specified are re-rendered on top via
 *        `opts.emphasisMap` — unless `opts.sourceEmphasisMode` says otherwise. Without this, `setBold(0, len - 1, false)`
 *        flattened every run that `insertRichTextFromHTML` had just set —
 *        which is why the Steinsaltz Talmud lost the bolding that
 *        distinguishes the Talmud's own words from Steinsaltz's interpolated
 *        explanation. Titles and metadata lines deliberately do NOT opt in:
 *        their emphasis is ours, not the source's, and the user's style
 *        preference must stay authoritative there.
 * @param {string} [opts.sourceEmphasisMode="keep"]  The user's choice for an
 *        opted-in paragraph (normalizeSourceEmphasisMode_): "keep" as above;
 *        "discard" applies the baseline only; "only" first removes the text
 *        the source did not emphasize (planEmphasisOnlyEdits_), then keeps
 *        the emphasis on what is left.
 * @param {Object} [opts.emphasisMap]  {bold: mapping, italic: mapping}. When
 *        absent, source emphasis is re-asserted as itself.
 */
function applyTypographyToParagraph(paragraph, font, size, style, opts) {
  if (!paragraph) {
    return;
  }

  const text = paragraph.editAsText();
  let len = text.getText().length;
  if (len <= 0) {
    return;
  }

  const options = opts || {};
  // Read from the typography bag at call time, never a module-scope cache —
  // see the `extendedGemaraPreference` row in docs/regression-log.md.
  const emphasisMode = options.preserveSourceEmphasis
    ? normalizeSourceEmphasisMode_(options.sourceEmphasisMode)
    : "discard";
  let emphasisRuns = emphasisMode === "discard" ? [] : captureEmphasisRuns_(text, len);

  if (emphasisMode === "only" && emphasisRuns.length) {
    applyTextEdits_(text, planEmphasisOnlyEdits_(text.getText(), emphasisRuns));
    len = text.getText().length;
    if (len <= 0) {
      return;
    }
    emphasisRuns = captureEmphasisRuns_(text, len);
  }

  if (font) {
    text.setFontFamily(0, len - 1, font);
  }
  if (!isNaN(size) && size > 0) {
    text.setFontSize(0, len - 1, size);
  }

  const fontStyle = String(style || "normal");
  const flags = fontStyle === "normal" ? [] : fontStyle.split(",");
  text.setBold(0, len - 1, flags.indexOf("bold") >= 0);
  text.setItalic(0, len - 1, flags.indexOf("italic") >= 0);
  text.setUnderline(0, len - 1, flags.indexOf("underline") >= 0);

  if (options.color) {
    text.setForegroundColor(0, len - 1, options.color);
  }
  if (options.background) {
    text.setBackgroundColor(0, len - 1, options.background);
  }

  // Re-render what the source emphasized, through the user's mapping. The
  // default mapping is the identity (bold renders as bold), but a user can map
  // Sefaria's bold to a colour, a different font, or nothing at all.
  const emphasisMap = options.emphasisMap || DEFAULT_EMPHASIS_MAP_;
  for (let i = 0; i < emphasisRuns.length; i++) {
    const run = emphasisRuns[i];
    if (run.bold) {
      applyEmphasisMapping_(text, run.start, run.end, emphasisMap.bold);
    }
    if (run.italic) {
      applyEmphasisMapping_(text, run.start, run.end, emphasisMap.italic);
    }
  }
}

// Identity mapping, used when a caller preserves emphasis without supplying a
// typography bag (keeps old behaviour for any call site that predates the map).
const DEFAULT_EMPHASIS_MAP_ = {
  bold: { style: 'bold', color: null, background: null, font: '' },
  italic: { style: 'italic', color: null, background: null, font: '' }
};

/**
 * Apply a named typography role (hebrew / translation / transliteration /
 * sourceTitle / sefariaLink) to a paragraph.
 *
 * This is the shape new code should use: it carries colour and background,
 * which the positional form cannot, and it keeps role lookup in one place.
 *
 * @param {Object} [overrides] {size, style, preserveSourceEmphasis}
 */
function applyRoleTypography_(paragraph, typography, roleName, overrides) {
  const role = (typography && typography.roles && typography.roles[roleName]) || null;
  if (!role) {
    return;
  }
  const extra = overrides || {};
  applyTypographyToParagraph(
    paragraph,
    role.font,
    extra.size !== undefined ? extra.size : role.size,
    extra.style !== undefined ? extra.style : role.style,
    {
      color: role.color,
      background: role.background,
      preserveSourceEmphasis: extra.preserveSourceEmphasis === true,
      sourceEmphasisMode: typography ? typography.sourceEmphasisMode : undefined,
      emphasisMap: typography ? typography.emphasisMap : null
    }
  );
}


/**
 * Language code of the translation in a Sefaria text payload. Sefaria files
 * many translations under "en" and marks the real language with a title
 * suffix ("... [fr]") or `actualLanguage`; the sidebar's normalizeLanguage
 * reads them the same way.
 */
function translationLanguageOf_(data) {
  if (!data) return "en";
  const title = String(data.versionTitle || "").trim();
  const versions = Array.isArray(data.versions) ? data.versions : [];
  const version = versions.filter(function (v) {
    return v && String(v.versionTitle || "").trim() === title && String(v.language || "").toLowerCase() !== "he";
  })[0] || null;
  const actual = String((version && version.actualLanguage) || data.actualLanguage || "").trim().toLowerCase();
  if (/^[a-z]{2,3}$/.test(actual) && actual !== "he") return actual;
  const suffix = /\[([a-z]{2,3})\]\s*$/i.exec(title);
  if (suffix && suffix[1].toLowerCase() !== "he") return suffix[1].toLowerCase();
  const declared = String((version && version.language) || "").trim().toLowerCase();
  return /^[a-z]{2,3}$/.test(declared) && declared !== "he" ? declared : "en";
}

/**
 * The typography bag to format one translation paragraph with: `typography`
 * itself, unless the translation's language has its own formatting, in which
 * case a copy whose translation role takes that language's font, size and
 * style (an empty font or size keeps the Translation one). Colours stay the
 * Translation role's.
 */
function typographyForTranslation_(typography, data) {
  const overrides = typography && typography.translationLanguages;
  const base = typography && typography.roles && typography.roles.translation;
  if (!overrides || !base) return typography;
  const entry = overrides[translationLanguageOf_(data)];
  if (!entry) return typography;
  const role = Object.assign({}, base, {
    font: entry.font || base.font,
    size: entry.size != null ? entry.size : base.size,
    style: entry.style || base.style
  });
  const roles = Object.assign({}, typography.roles, { translation: role });
  return Object.assign({}, typography, { roles: roles });
}

/**
 * Font family and size of the text where the user is inserting, for the
 * "match the document" typography default. Reads the paragraph holding the
 * cursor (or the start of the selection); if that is a heading or empty, the
 * nearest preceding body-text paragraph. Returns {font, size}, either of which
 * may be null — Docs reports null when the text just follows the Normal text
 * style, and leaving it unset gives the same result.
 */
function readSurroundingTextStyle_() {
  const doc = DocumentApp.getActiveDocument();
  let element = null;
  let offset = 0;
  const cursor = doc.getCursor();
  if (cursor) {
    element = cursor.getElement();
    offset = cursor.getOffset();
  } else {
    const selection = doc.getSelection();
    const ranges = selection ? selection.getRangeElements() : [];
    if (ranges.length) {
      element = ranges[0].getElement();
      offset = ranges[0].isPartial() ? ranges[0].getStartOffset() : 0;
    }
  }
  if (!element) return null;

  const isTextElement = element.getType() === DocumentApp.ElementType.TEXT;
  let paragraph = element;
  while (paragraph && !isBodyTextBlock_(paragraph)) {
    paragraph = paragraph.getParent ? paragraph.getParent() : null;
  }

  // Up to a screenful back; past that the "surrounding" text is not really
  // surrounding any more, and the Normal text style is the better answer.
  let charIndex = isTextElement ? offset - 1 : 0;
  for (let steps = 0; paragraph && steps < 20; steps++) {
    const text = paragraph.editAsText();
    const length = text.getText().length;
    if (length > 0 && isNormalTextParagraph_(paragraph)) {
      const at = Math.max(0, Math.min(length - 1, charIndex));
      return { font: text.getFontFamily(at), size: text.getFontSize(at) };
    }
    charIndex = Infinity; // earlier paragraphs: sample their last character
    do {
      paragraph = paragraph.getPreviousSibling();
    } while (paragraph && !isBodyTextBlock_(paragraph));
  }
  return null;
}

function isBodyTextBlock_(element) {
  const type = element.getType();
  return type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM;
}

function isNormalTextParagraph_(block) {
  try {
    return block.getHeading() === DocumentApp.ParagraphHeading.NORMAL;
  } catch (error) {
    return true;
  }
}

/** "heading1".."heading6" → DocumentApp.ParagraphHeading; anything else → null. */
function titleParagraphHeading_(titleHeading) {
  const match = /^heading([1-6])$/.exec(String(titleHeading || ''));
  return match ? DocumentApp.ParagraphHeading['HEADING' + match[1]] : null;
}

function applyTitleTypography(paragraph, typography, insertSefariaLink) {
  // The heading goes on first, so any font/size the user set explicitly still
  // overrides the heading's look, and an empty one leaves it showing.
  const heading = titleParagraphHeading_(typography && typography.titleHeading);
  if (heading && paragraph && paragraph.setHeading) {
    paragraph.setHeading(heading);
  }
  // Titles deliberately do NOT preserve source emphasis: the bold/underline on
  // a title is applied by this add-on, so the user's title style stays
  // authoritative there.
  applyRoleTypography_(
    paragraph,
    typography,
    insertSefariaLink ? 'sefariaLink' : 'sourceTitle'
  );
}

function insertTransliterationParagraphAfter(doc, index, transliterationText, typography, ltr) {
  if (!transliterationText) {
    return;
  }
  let paragraph = doc.insertParagraph(index, transliterationText);
  paragraph.setLeftToRight(ltr !== false);
  paragraph.setAttributes({});
  applyRoleTypography_(paragraph, typography, 'transliteration');
}

function insertTransliterationIntoCell(cell, transliterationText, typography) {
  if (!cell || !transliterationText) {
    return;
  }
  let paragraph = cell.insertParagraph(cell.getNumChildren(), transliterationText);
  paragraph.setLeftToRight(true);
  paragraph.setAttributes({});
  applyRoleTypography_(paragraph, typography, 'transliteration');
}

function getAttributionParagraphText(attributionLines) {
  if (!attributionLines || !Array.isArray(attributionLines) || attributionLines.length === 0) {
    return "";
  }
  return attributionLines.join("\n");
}

function insertAttributionParagraph(paragraph, attributionLines) {
  const attributionText = getAttributionParagraphText(attributionLines);
  if (!attributionText) {
    return;
  }

  paragraph.setText(attributionText);
  let attributionStyle = {};
      attributionStyle[DocumentApp.Attribute.ITALIC] = true;
      attributionStyle[DocumentApp.Attribute.FONT_SIZE] = 8;
      attributionStyle[DocumentApp.Attribute.BOLD] = false;
      attributionStyle[DocumentApp.Attribute.UNDERLINE] = false;
  paragraph.setAttributes(attributionStyle);
  paragraph.setLeftToRight(true);
}

/**
 * Credit lines for the Hebrew edition, the counterpart of
 * getEnglishAttributionLines (attribution.gs, which stays English-only). The
 * v1 texts API returns the Hebrew version's title and license as
 * heVersionTitle / heLicense; each edition carries its own license, which is
 * the line that matters for reuse.
 */
function getHebrewAttributionLines_(data) {
  const title = String((data && data.heVersionTitle) || '').trim();
  if (!title) return [];
  const lines = ['Hebrew: ' + title];
  const license = String((data && (data.heLicense || data.heVersionLicense)) || '').trim();
  if (license) lines.push('License: ' + license);
  return lines;
}

function buildCitationLines(data, preferredTitle, includeTranslationSourceInfo) {
  const titleLine = String((preferredTitle || (data && data.ref) || '')).trim();
  const lines = [];
  if (titleLine) lines.push(titleLine);

  const englishVersion = String((data && data.versionTitle) || '').trim();
  const englishSource = String((data && data.versionSource) || '').trim();
  const hebrewVersion = String((data && data.heVersionTitle) || '').trim();
  const hebrewSource = String((data && data.heVersionSource) || '').trim();
  const license = String((data && (data.license || data.licenseName || data.licenseString)) || '').trim();
  const hebrewLicense = String((data && (data.heLicense || data.heVersionLicense)) || '').trim();
  const author = String((data && (data.author || data.collectiveTitle || data.authors)) || '').trim();

  if (author) lines.push('Author: ' + author);
  if (includeTranslationSourceInfo && englishVersion) lines.push('Translation: ' + englishVersion);
  if (includeTranslationSourceInfo && englishSource) lines.push('Translation source: ' + englishSource);
  if (hebrewVersion) lines.push('Source edition: ' + hebrewVersion);
  if (hebrewSource) lines.push('Source edition URL: ' + hebrewSource);
  if (license && hebrewLicense && license !== hebrewLicense) {
    lines.push('Translation license: ' + license);
    lines.push('Source edition license: ' + hebrewLicense);
  } else if (license || hebrewLicense) {
    lines.push('License: ' + (license || hebrewLicense));
  }
  return lines.filter(Boolean);
}

function insertCitationParagraph(doc, insertAtIndex, citationLines) {
  if (!citationLines || !citationLines.length) return;
  const paragraph = doc.insertParagraph(insertAtIndex, citationLines.join(''));
  insertAttributionParagraph(paragraph, citationLines);
}

function buildLinkedTitleText(baseTitle, data, singleLanguage) {
  let safeTitle = String(baseTitle || '').trim();
  let modeLabel = singleLanguage === 'he' ? 'Hebrew' : (singleLanguage === 'en' ? 'Translation' : 'Bilingual');
  let versionLabel = '';

  if (singleLanguage === 'he') {
    versionLabel = String((data && data.heVersionTitle) || '').trim();
  } else if (singleLanguage === 'en') {
    versionLabel = String((data && data.versionTitle) || '').trim();
  } else {
    const enVersion = String((data && data.versionTitle) || '').trim();
    const heVersion = String((data && data.heVersionTitle) || '').trim();
    if (enVersion && heVersion) {
      versionLabel = `EN: ${enVersion}; HE: ${heVersion}`;
    } else {
      versionLabel = enVersion || heVersion;
    }
  }

  if (!versionLabel) {
    return `${safeTitle} (${modeLabel})`;
  }
  return `${safeTitle} (${modeLabel} • ${versionLabel})`;
}

/**
 * Insert a resolved Sefaria source into the active Google Doc.
 *
 * Signature is an options bag so callers don't have to remember the order of
 * nine positional booleans. The internal body still uses the same local
 * variable names that the pre-refactor positional signature used, which is
 * why the destructure is so explicit — it keeps the 350-line body stable
 * while fixing the ergonomics at the call site.
 *
 * @param {Object} data          Resolved Sefaria payload (required).
 * @param {Object} [opts]        Per-call display/layout overrides.
 * @param {string} [opts.singleLanguage]                "he" | "en" | undefined (bilingual).
 * @param {boolean|string} [opts.pasukPreference=true]  Include line markers.
 * @param {string|null} [opts.preferredTitle]           Override the title shown (e.g. "Bereishit").
 * @param {boolean} [opts.includeTranslationSourceInfo] Append translation attribution.
 * @param {string} [opts.bilingualLayout="he-right"]    Bilingual layout mode.
 * @param {boolean} [opts.insertSefariaLink]            Hyperlink the title to sefaria.org.
 * @param {boolean} [opts.includeTransliteration]       Include transliteration of the Hebrew.
 * @param {boolean} [opts.insertCitationOnly]           Insert just the citation title, no body.
 * @param {string} [opts.sourceEmphasisMode]            "keep" | "discard" | "only"; omitted
 *                                                      means the stored `source_emphasis_mode`.
 * @param {string} [opts.transliterationScheme]         Omitted means the stored `transliteration_scheme`.
 * @param {boolean} [opts.preserveSelection]            Keep a selection and insert after it (default: replace it).
 * @param {Object}  [opts.insertAfterElement]           Insert after this element instead of at the cursor (server-side callers only).
 * @returns {{notice: string}} notice is non-empty when the insert went somewhere other than the cursor.
 */
function insertReference(data, opts) {
  const options = opts || {};
  let singleLanguage = options.singleLanguage;
  const pasukPreference = options.pasukPreference !== undefined ? options.pasukPreference : true;
  const preferredTitle = options.preferredTitle !== undefined ? options.preferredTitle : null;
  const includeTranslationSourceInfo = options.includeTranslationSourceInfo === true;
  const bilingualLayout = options.bilingualLayout || "he-right";
  const insertSefariaLink = options.insertSefariaLink === true;
  const includeTransliteration = options.includeTransliteration === true;
  const insertCitationOnly = options.insertCitationOnly === true;

  if (!data || !data.ref) {
    throw new Error("Unable to insert source: no resolved reference.");
  }

  let title = (preferredTitle) ? preferredTitle : data.ref;
  const includeLineMarkers = pasukPreference === true || pasukPreference === 'true';
  data = formatDataForPesukim(data, includeLineMarkers);
  // heRef is inserted as plain text in most layouts, and Sefaria escapes
  // some titles (סידור רש&quot;י).
  if (typeof data.heRef === 'string') {
    data = Object.assign({}, data, { heRef: decodeHTMLEntities(data.heRef) });
  }
  // A bilingual insert of a source with only one language (Siddur Rashi has
  // no translation) inserts that language alone, not an empty titled block.
  if (!singleLanguage) {
    const hasHebrew = hasInsertableText_(data.he);
    const hasTranslation = hasInsertableText_(data.text);
    if (hasHebrew && !hasTranslation) singleLanguage = 'he';
    else if (hasTranslation && !hasHebrew) singleLanguage = 'en';
  }

  // Side-by-side layouts are a table of their own; everything else is
  // paragraphs, which can also go inside a table cell. See insertion-target.gs.
  const createsTable = !singleLanguage && bilingualLayout !== "he-top";
  const target = resolveInsertionTarget_({
    layout: createsTable ? 'table' : 'paragraphs',
    // Unchanged from before: a selection is replaced unless the caller asks
    // to keep it (the linker's per-row insert, Insert from Selection's
    // keep-selection setting).
    replaceSelection: options.preserveSelection !== true && !options.insertAfterElement,
    anchor: options.insertAfterElement || null
  });
  let doc = target.container;
  let index = target.index;

  let headerStyle = {};
        headerStyle[DocumentApp.Attribute.BOLD] = true;
        headerStyle[DocumentApp.Attribute.UNDERLINE] = true;
  let nullStyle = {};
        nullStyle[DocumentApp.Attribute.BOLD] = false;
        nullStyle[DocumentApp.Attribute.UNDERLINE] = false;
  let noUnderline = {};
    noUnderline[DocumentApp.Attribute.UNDERLINE] = false;

  // Credit every edition that is actually inserted: the translation unless
  // this is a Hebrew-only insert, the Hebrew edition unless it is
  // translation-only.
  const shouldIncludeEnglishAttribution = includeTranslationSourceInfo && singleLanguage != "he";
  const shouldIncludeHebrewAttribution = includeTranslationSourceInfo && singleLanguage != "en";
  let attributionLines = [].concat(
    shouldIncludeEnglishAttribution ? getEnglishAttributionLines(data) : [],
    shouldIncludeHebrewAttribution ? getHebrewAttributionLines_(data) : []
  );
  const typography = getTypographySettings();
  // The sidebar's B&I button can override the stored choice for this insert.
  if (options.sourceEmphasisMode) {
    typography.sourceEmphasisMode = normalizeSourceEmphasisMode_(options.sourceEmphasisMode);
  }
  const currentPrefs = getPreferences();
  const transliterationScheme = options.transliterationScheme || currentPrefs.transliteration_scheme || "traditional";
  const transliterationDageshMode = currentPrefs.transliteration_biblical_dagesh_mode || "none";
  const transliterationIsBiblical = currentPrefs.transliteration_is_biblical_hebrew !== "false";
  const isBiblicalHebrewText = transliterationIsBiblical && data.type == "Tanakh";
  const transliterationOverrides = (() => {
    try {
      return JSON.parse(currentPrefs.transliteration_overrides || '{}') || {};
    } catch (error) {
      return {};
    }
  })();
  const transliterationTextRaw = (includeTransliteration && data.he)
    ? transliterateHebrewHtmlPreservingBasicBreaks(data.he, transliterationScheme, {
        keepNiqqud: true,
        isBiblicalHebrew: isBiblicalHebrewText,
        dageshMode: isBiblicalHebrewText ? transliterationDageshMode : "none",
        overrideMap: transliterationOverrides
      })
    : "";
  const transliterationText = (data.lineMarkersApplied && transliterationTextRaw)
    ? normalizeTransliterationLineMarkersToGematria(transliterationTextRaw, (data.sections && data.sections[1]) ? data.sections[1] : 1)
    : transliterationTextRaw;
  const sefariaUrl = `https://www.sefaria.org/${encodeURIComponent(data.ref || '').replace(/%20/g, '_')}`;

  const shouldAppendCitation = (insertCitationOnly === true || insertCitationOnly === "true");
  const citationLines = shouldAppendCitation ? buildCitationLines(data, title, includeTranslationSourceInfo) : [];

  const appendCitationParagraph = (insertAtIndex) => {
    if (!shouldAppendCitation) return;
    insertCitationParagraph(doc, insertAtIndex, citationLines);
  };

  let resolvedBilingualLayout = (singleLanguage) ? null : (bilingualLayout || "he-right");
  if (resolvedBilingualLayout !== "he-left" && resolvedBilingualLayout !== "he-top" && resolvedBilingualLayout !== "he-right") {
    resolvedBilingualLayout = "he-right";
  }

  if (singleLanguage) {
    let ltr = (singleLanguage == "he") ? false : true;
    let titleText = (singleLanguage == "he") ? data.heRef : title;
    if (insertSefariaLink) {
      titleText = buildLinkedTitleText(titleText, data, singleLanguage);
    }
    let mainText = (singleLanguage == "he") ? data.he : data.text;

    doc.insertParagraph(index, titleText)
      .setAttributes(headerStyle)
      .setLeftToRight(ltr);
    let insertedTitle = doc.getChild(index).asParagraph();
    applyTitleTypography(insertedTitle, typography, insertSefariaLink);
    if (insertSefariaLink) {
      insertedTitle.editAsText().setLinkUrl(sefariaUrl);
    }

    let mainTextParagraph = doc.insertParagraph(index+1, "");
    // nullStyle carries BOLD=false, so it has to land on the still-empty
    // paragraph. Applying it after insertRichTextFromHTML flattened the
    // source's own bold runs before they could be preserved.
    if (singleLanguage == "he") {
      mainTextParagraph.setAttributes(nullStyle);
    }
    insertRichTextFromHTML(mainTextParagraph, mainText);
    mainTextParagraph.setAttributes(noUnderline);
    mainTextParagraph.setLeftToRight(ltr);
    applyRoleTypography_(
      mainTextParagraph,
      singleLanguage == "he" ? typography : typographyForTranslation_(typography, data),
      singleLanguage == "he" ? 'hebrew' : 'translation',
      { preserveSourceEmphasis: true }
    );

    if (singleLanguage == "he" && transliterationText) {
      insertTransliterationParagraphAfter(doc, index + 2, transliterationText, typography, true);
    }

    let singleLanguageNextIndex = index + 2;

    if (singleLanguage == "he" && transliterationText) {
      singleLanguageNextIndex += 1;
    }

    if (attributionLines.length > 0) {
      let attributionParagraph = doc.insertParagraph(singleLanguageNextIndex, "");
      insertAttributionParagraph(attributionParagraph, attributionLines);
      singleLanguageNextIndex += 1;
    }

    appendCitationParagraph(singleLanguageNextIndex);
  }
  else {
    if (resolvedBilingualLayout == "he-top") {
      doc.insertParagraph(index, insertSefariaLink ? buildLinkedTitleText(data.heRef, data, 'he') : data.heRef)
        .setAttributes(headerStyle)
        .setLeftToRight(false);
      let hebTitleParagraph = doc.getChild(index).asParagraph();
      applyTitleTypography(hebTitleParagraph, typography, insertSefariaLink);
      if (insertSefariaLink) {
        hebTitleParagraph.editAsText().setLinkUrl(sefariaUrl);
      }

      let hebTextParagraph = doc.insertParagraph(index + 1, "");
      hebTextParagraph.setLeftToRight(false);
      hebTextParagraph.setAttributes(nullStyle);
      insertRichTextFromHTML(hebTextParagraph, data.he);
      hebTextParagraph.setAttributes(noUnderline);
      applyRoleTypography_(hebTextParagraph, typography, 'hebrew', { preserveSourceEmphasis: true });

      if (transliterationText) {
        insertTransliterationParagraphAfter(doc, index + 2, transliterationText, typography, true);
      }

      doc.insertParagraph(index + (transliterationText ? 3 : 2), insertSefariaLink ? buildLinkedTitleText(title, data, 'en') : title)
        .setAttributes(headerStyle)
        .setLeftToRight(true);
      let enTitleParagraph = doc.getChild(index + (transliterationText ? 3 : 2)).asParagraph();
      applyTitleTypography(enTitleParagraph, typography, insertSefariaLink);
      if (insertSefariaLink) {
        enTitleParagraph.editAsText().setLinkUrl(sefariaUrl);
      }

      let engTextParagraph = doc.insertParagraph(index + (transliterationText ? 4 : 3), "");
      engTextParagraph.setLeftToRight(true);
      engTextParagraph.setAttributes(nullStyle);
      insertRichTextFromHTML(engTextParagraph, data.text);
      engTextParagraph.setAttributes(noUnderline);
      applyRoleTypography_(engTextParagraph, typographyForTranslation_(typography, data), 'translation', { preserveSourceEmphasis: true });

      let heTopNextIndex = index + (transliterationText ? 5 : 4);

      if (attributionLines.length > 0) {
        let attributionParagraph = doc.insertParagraph(heTopNextIndex, "");
        insertAttributionParagraph(attributionParagraph, attributionLines);
        heTopNextIndex += 1;
      }

      appendCitationParagraph(heTopNextIndex);
    } else {
      let cells = [
        ["", ""],
        ["", ""]
      ];
      let tableStyle = {};
          tableStyle[DocumentApp.Attribute.BOLD] = false;
      let table = doc.insertTable(index, cells)

      table.setAttributes(tableStyle);

      let englishColumn = (resolvedBilingualLayout == "he-left") ? 1 : 0;
      let hebrewColumn = (resolvedBilingualLayout == "he-left") ? 0 : 1;

      let engTitle = table.getCell(0, englishColumn)
        .setText("")
        .insertParagraph(0, "");
      engTitle.setLeftToRight(true);
      insertRichTextFromHTML(engTitle, insertSefariaLink ? buildLinkedTitleText(title, data, 'en') : title);
      engTitle.setAttributes(headerStyle);
      applyTitleTypography(engTitle, typography, insertSefariaLink);
      if (insertSefariaLink) {
        engTitle.editAsText().setLinkUrl(sefariaUrl);
      }

      let hebTitle = table.getCell(0, hebrewColumn)
        .setText("")
        .insertParagraph(0, "");
      hebTitle.setLeftToRight(false);
      insertRichTextFromHTML(hebTitle, insertSefariaLink ? buildLinkedTitleText(data.heRef, data, 'he') : data.heRef);
      hebTitle.setAttributes(headerStyle);
      applyTitleTypography(hebTitle, typography, insertSefariaLink);
      if (insertSefariaLink) {
        hebTitle.editAsText().setLinkUrl(sefariaUrl);
      }

      let engText = table.getCell(1, englishColumn)
        .setText("")
        .insertParagraph(0, "")
        .setLeftToRight(true);
      engText.setAttributes(nullStyle);
      insertRichTextFromHTML(engText, data.text);
      engText.setAttributes(noUnderline);
      applyRoleTypography_(engText, typographyForTranslation_(typography, data), 'translation', { preserveSourceEmphasis: true });

      let hebText = table.getCell(1, hebrewColumn)
        .setText("")
        .insertParagraph(0, "");
      hebText.setLeftToRight(false);
      hebText.setAttributes(nullStyle);
      insertRichTextFromHTML(hebText, data.he);
      hebText.setAttributes(noUnderline);
      applyRoleTypography_(hebText, typography, 'hebrew', { preserveSourceEmphasis: true });

      let sideBySideNextIndex = index + 1;

      if (attributionLines.length > 0) {
        let attributionParagraph = doc.insertParagraph(index + 1, "");
        insertAttributionParagraph(attributionParagraph, attributionLines);
        sideBySideNextIndex += 1;
      }

      appendCitationParagraph(sideBySideNextIndex);

      for (let r = 0; r < table.getNumRows(); r++) {
        const row = table.getRow(r);
        for (let c = 0; c < row.getNumCells(); c++) {
          const cell = row.getCell(c);
          const n = cell.getNumChildren();
          cell.getChild(n - 1).removeFromParent();
        }
      }

      if (transliterationText) {
        insertTransliterationIntoCell(table.getCell(1, hebrewColumn), transliterationText, typography);
      }
    }
  }

  // Non-empty when the insert went somewhere other than the cursor (below a
  // table); the caller shows it, so the move is never silent.
  return { notice: target.notice };
}

/**
 * True when a Sefaria text field (string, or nested array of segments) has
 * something to show once markup and whitespace entities are removed.
 */
function hasInsertableText_(value) {
  if (Array.isArray(value)) {
    return value.some(function (part) { return hasInsertableText_(part); });
  }
  if (value === null || value === undefined) return false;
  const stripped = String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|thinsp|ensp|emsp|hairsp|zwnj|zwj|lrm|rlm|#160|#8201);/gi, ' ')
    .trim();
  return stripped.length > 0;
}

/**
 * Pair each requested translation with its resolved payload, dropping the ones
 * that must not be inserted:
 *   - duplicates in the request (the same version selected twice);
 *   - payloads that failed to resolve;
 *   - payloads where Sefaria silently substituted a different version (it
 *     falls back to its default when the requested one has no text for the
 *     ref, which inserted the default translation twice);
 *   - versions whose English text is empty for this ref.
 *
 * @param {string[]} versionTitles  Requested titles, in insertion order.
 * @param {Array<Object>} dataList  Resolved payloads, index-aligned with versionTitles.
 * @return {{kept: Array<{versionTitle: string, data: Object}>, skipped: string[]}}
 */
function selectInsertableVersions_(versionTitles, dataList) {
  const kept = [];
  const skipped = [];
  const seen = {};
  for (let i = 0; i < versionTitles.length; i++) {
    const requested = String(versionTitles[i] || '').trim();
    if (!requested || seen[requested]) continue;
    seen[requested] = true;
    const data = dataList[i];
    const resolvedTitle = String((data && data.versionTitle) || '').trim();
    if (!data || resolvedTitle !== requested || !hasInsertableText_(data.text)) {
      skipped.push(requested);
      continue;
    }
    kept.push({ versionTitle: requested, data: data });
  }
  return { kept: kept, skipped: skipped };
}

/**
 * Title for one translation block of a multi-version insert. The linked form
 * already names the version ("Title (Translation • Version)"), so the plain
 * "(Version)" suffix is only added when there is no link — adding both printed
 * the version twice.
 */
function buildVersionBlockTitle_(baseTitle, versionTitle, data, insertSefariaLink, blockCount) {
  if (insertSefariaLink) {
    return buildLinkedTitleText(baseTitle, data, 'en');
  }
  let title = String(baseTitle || '').trim();
  const shortVt = String(versionTitle || '').trim().substring(0, 50);
  if (blockCount > 1 && shortVt) title = title + ' (' + shortVt + ')';
  return title;
}

/**
 * sefaria.org link for a ref, pinned to specific versions when given so each
 * block of a multi-version insert opens the translation it shows.
 */
function buildSefariaVersionUrl_(ref, enVersionTitle, heVersionTitle) {
  const encode = function (value) {
    return encodeURIComponent(String(value || '')).replace(/%20/g, '_');
  };
  const params = [];
  if (enVersionTitle) params.push('ven=' + encode(enVersionTitle));
  if (heVersionTitle) params.push('vhe=' + encode(heVersionTitle));
  return 'https://www.sefaria.org/' + encode(ref) + (params.length ? '?' + params.join('&') : '');
}

/**
 * Insert the same reference in multiple translation versions into the active document.
 * Only valid for "translation only" (singleLanguage="en") and "Hebrew on top" (bilingualLayout="he-top") modes.
 * For he-top: inserts the Hebrew block once, then each translation in sequence.
 * For en: inserts each translation as its own title + body block in sequence.
 * Consecutive translation blocks are separated by an empty paragraph.
 *
 * @param {string} ref           Resolved Sefaria reference string.
 * @param {Object} opts
 * @param {string[]} opts.versionTitles        Array of English version titles to insert.
 * @param {string}  [opts.heVersionTitle]      Hebrew version title.
 * @param {string}  [opts.singleLanguage]      "en" for translation-only mode; omit for he-top.
 * @param {string}  [opts.bilingualLayout]     Expected "he-top" when not singleLanguage.
 * @param {boolean} [opts.pasukPreference]     Include line markers.
 * @param {string}  [opts.preferredTitle]      Override displayed title (e.g. "Bereishit 1:1").
 * @param {boolean} [opts.includeTranslationSourceInfo] Append attribution.
 * @param {boolean} [opts.insertSefariaLink]   Hyperlink title to sefaria.org.
 * @param {string}  [opts.sourceEmphasisMode]  "keep" / "discard" / "only";
 *        omitted means the stored `source_emphasis_mode` preference.
 * @return {{inserted: string[], skipped: string[]}} Version titles inserted, and
 *         those left out because they have no text for this ref.
 */
function insertReferenceVersions(ref, opts) {
  const options = opts || {};
  const versionTitles = Array.isArray(options.versionTitles) ? options.versionTitles.filter(Boolean) : [];
  const heVersionTitle = options.heVersionTitle || '';
  const singleLanguage = options.singleLanguage;
  const pasukPreference = options.pasukPreference !== undefined ? options.pasukPreference : true;
  const preferredTitle = options.preferredTitle || null;
  const includeTranslationSourceInfo = options.includeTranslationSourceInfo === true;
  const insertSefariaLink = options.insertSefariaLink === true;

  if (!ref) throw new Error('insertReferenceVersions: no reference provided.');
  if (!versionTitles.length) throw new Error('insertReferenceVersions: no version titles provided.');

  const resolved = versionTitles.map(function (vt) {
    return findReference(ref, { en: vt, he: heVersionTitle });
  });
  const selection = selectInsertableVersions_(versionTitles, resolved);
  const kept = selection.kept;

  if (!kept.length) {
    throw new Error('None of the selected translations has text for this reference.');
  }

  const includeLineMarkers = pasukPreference === true || pasukPreference === 'true';
  const typography = getTypographySettings();
  if (options.sourceEmphasisMode) {
    typography.sourceEmphasisMode = normalizeSourceEmphasisMode_(options.sourceEmphasisMode);
  }

  // Always paragraphs (translation-only or Hebrew on top), so this can go
  // inside a table cell. A selection is kept, as it always was on this path.
  const target = resolveInsertionTarget_({ layout: 'paragraphs', replaceSelection: false });
  let doc = target.container;
  let index = target.index;

  let headerStyle = {};
  headerStyle[DocumentApp.Attribute.BOLD] = true;
  headerStyle[DocumentApp.Attribute.UNDERLINE] = true;
  let nullStyle = {};
  nullStyle[DocumentApp.Attribute.BOLD] = false;
  let noUnderline = {};
  noUnderline[DocumentApp.Attribute.UNDERLINE] = false;
  let separatorStyle = {};
  separatorStyle[DocumentApp.Attribute.BOLD] = false;
  separatorStyle[DocumentApp.Attribute.ITALIC] = false;
  separatorStyle[DocumentApp.Attribute.UNDERLINE] = false;

  const insertSeparator = () => {
    doc.insertParagraph(index, '').setAttributes(separatorStyle).setLeftToRight(true);
    index += 1;
  };

  if (singleLanguage !== 'en') {
    // Hebrew on top: insert Hebrew once from the first version, then each translation.
    let firstData = formatDataForPesukim(kept[0].data, includeLineMarkers);
    let heTitle = insertSefariaLink ? buildLinkedTitleText(firstData.heRef, firstData, 'he') : firstData.heRef;
    doc.insertParagraph(index, heTitle).setAttributes(headerStyle).setLeftToRight(false);
    let heTitlePara = doc.getChild(index).asParagraph();
    applyTitleTypography(heTitlePara, typography, insertSefariaLink);
    if (insertSefariaLink) {
      heTitlePara.editAsText().setLinkUrl(buildSefariaVersionUrl_(ref, '', firstData.heVersionTitle || heVersionTitle));
    }

    let heTextPara = doc.insertParagraph(index + 1, '');
    heTextPara.setLeftToRight(false).setAttributes(nullStyle);
    insertRichTextFromHTML(heTextPara, firstData.he);
    heTextPara.setAttributes(noUnderline);
    applyRoleTypography_(heTextPara, typography, 'hebrew', { preserveSourceEmphasis: true });
    index += 2;
  }

  // Each block is inserted at the same position, last block first. A new Docs
  // paragraph takes its text formatting from the one before it, so inserting
  // first-to-last gave block 1's title the formatting of the text at the
  // cursor and every later title that of the previous block's 8pt attribution
  // line: with fonts left on "Match the document", only the first translation
  // looked right. Inserted backwards, every title follows the same paragraph
  // the first one does. The document order is unchanged.
  const blockStart = index;
  for (let i = kept.length - 1; i >= 0; i--) {
    index = blockStart;

    let d = formatDataForPesukim(kept[i].data, includeLineMarkers);
    let displayTitle = buildVersionBlockTitle_(preferredTitle || d.ref, kept[i].versionTitle, d, insertSefariaLink, kept.length);
    doc.insertParagraph(index, displayTitle).setAttributes(headerStyle).setLeftToRight(true);
    let titlePara = doc.getChild(index).asParagraph();
    applyTitleTypography(titlePara, typography, insertSefariaLink);
    if (insertSefariaLink) {
      titlePara.editAsText().setLinkUrl(buildSefariaVersionUrl_(ref, kept[i].versionTitle, ''));
    }

    let textPara = doc.insertParagraph(index + 1, '');
    textPara.setLeftToRight(true).setAttributes(nullStyle);
    insertRichTextFromHTML(textPara, d.text);
    textPara.setAttributes(noUnderline);
    applyRoleTypography_(textPara, typographyForTranslation_(typography, d), 'translation', { preserveSourceEmphasis: true });
    index += 2;

    if (includeTranslationSourceInfo) {
      let attrLines = getEnglishAttributionLines(d);
      if (attrLines.length) {
        let attrPara = doc.insertParagraph(index, '');
        insertAttributionParagraph(attrPara, attrLines);
        index += 1;
      }
    }

    // A blank paragraph after every block, the last one included, so whatever
    // follows the insert point (typically the next source) doesn't butt
    // against the last citation.
    insertSeparator();
  }

  return {
    inserted: kept.map(function (entry) { return entry.versionTitle; }),
    skipped: selection.skipped,
    notice: target.notice
  };
}

// Converts HTML from Sefaria API to rich-text in Google Docs.
// Handles <b>, <i>, <br>, <sup> (footnotes) tags and escapes HTML entities.
function insertRichTextFromHTML(element, htmlString) {
  const extendedGemaraPreference =
    PropertiesService.getUserProperties().getProperty("extended_gemara") === "true";

  element = element.editAsText();
  let buf = [];
  let index = 0, italicsFnCount = 0, textLength = element.editAsText().getText().length;
  let bolded = false, italicized = false, inFootnote = false;

  if (Array.isArray(htmlString)) {
    htmlString = htmlString.join("");
  }
  let iterableString = htmlString.split(/(<\/?[a-zA-Z]+[^>]*>)/g);

  let inserterFn = (textModification) => {
    let snippet = buf.join("");
    snippet = decodeHTMLEntities(snippet);

    let snippetLength = snippet.length;
    let snippetIndex = snippetLength - 1;

    if (snippet != "") {
      element.insertText(textLength, snippet);

      element.setBold(textLength, textLength+snippetIndex, bolded);
      element.setItalic(textLength, textLength+snippetIndex, italicized);

      textLength += snippetLength;
    }

    switch(textModification) {
      case "bold":
        bolded = !bolded;
        break;
      case "italic":
        italicized = !italicized;
        break;
      case "linebreak":
        element.insertText(textLength, "\n");
        textLength += 1;
        break;
    }
  }

  for (let i = 0; i < iterableString.length; i++) {
    let word = iterableString[i];

    if (inFootnote) {
      if ( word == "<i class=\"footnote\">" || word == "<i>") {
        italicsFnCount++;
      } else if ( word == "</i>") {
        italicsFnCount--;
        if (italicsFnCount == 0) {
          inFootnote = false;
          continue;
        }
      }
    }
    else if (i % 2 === 1) {
      // split() with a capture group puts every tag at an odd index. Only the
      // tag name matters: matching the whole tag against a narrow attribute
      // alphabet returned null on Sefaria's commentary anchors (Shulchan
      // Arukh: hrefs with "." and "_", Hebrew data-label values) and threw,
      // leaving a half-inserted source.
      let tagName = /^<\/?([a-zA-Z]+)/.exec(word)[1].toLowerCase();

      switch (tagName) {
        case "b":
          inserterFn("bold");
          buf = [];
          index = 0;
          break;
        case "strong":
          if (!extendedGemaraPreference || bolded) {
            inserterFn("bold");
          }
          buf = [];
          index = 0;
          break;
        case "i":
          if (!extendedGemaraPreference || bolded) {
            inserterFn("italic");
          }
          buf = [];
          index = 0;
          break;
        case "br":
          inserterFn("linebreak");
          buf = [];
          index = 0;
          break;
        case "sup":
          inFootnote = true;
          italicsFnCount = 0;
          break;
        default:
          break;
      }
      continue;
    }

    if (!inFootnote) {
      buf[index++] = word;
    }
  }

  let snippet = buf.join("");
  if ( snippet != "" ) {
    snippet = decodeHTMLEntities(snippet);
    element.insertText(textLength, snippet);
    let snippetIndex = snippet.length - 1;
    // Use the live flags, not a hardcoded false: markup that never closes its
    // <b>/<i> would otherwise drop the emphasis on the final run.
    element.setBold(textLength, textLength+snippetIndex, bolded);
    element.setItalic(textLength, textLength+snippetIndex, italicized);
  }
}
