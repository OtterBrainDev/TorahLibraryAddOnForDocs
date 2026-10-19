// Linker pre-filter: decide locally which parts of a document could possibly
// contain a Sefaria reference, so only those windows are uploaded to
// /api/find-refs instead of the user's entire document body.
//
// Why this exists: "Link Texts with Sefaria" previously sent
// `getBody().getText()` — every word the user had written — to a third-party
// server. That is a lot of trust to ask for a feature that only cares about
// citations. This module keeps the prose at home.
//
// The functions here are PURE (no DocumentApp, no UrlFetchApp,
// no PropertiesService) so they can be unit-tested in Node. See
// test/tests/linker-prefilter.test.js.
//
// Design note on recall: the pre-filter is deliberately generous. It keeps a
// window if it sees a known book title, an abbreviation with gershayim, a
// numeric citation, or a Hebrew-numeral citation — and then pads that window
// with surrounding context, because Sefaria's linker resolves some references
// (ranges, "ibid."-style continuations) from their neighbours. Being too eager
// costs a few extra characters of upload; being too strict silently drops
// links the user expects, which is much worse.

var LINKER_WINDOW_PADDING_ = 160;
var LINKER_SEGMENT_SEPARATOR_ = '\n\n';

/**
 * Normalize a title for matching: casefold, strip Hebrew gershayim and Latin
 * apostrophes, and collapse whitespace.
 */
function normalizeLinkerToken_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[‘’׳״′″'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build the set of first tokens of every known Sefaria title.
 *
 * We index on the FIRST token only. A document mentioning "Bava Metzia 59b"
 * contains the token "bava"; that is enough to mark the window as a candidate
 * and let Sefaria's linker do the real parsing. Matching whole titles locally
 * would mean reimplementing the linker, which is exactly what we do not want
 * to do.
 */
function buildLinkerTitleIndex_(titles) {
  var index = Object.create(null);
  if (!Array.isArray(titles)) {
    return index;
  }
  for (var i = 0; i < titles.length; i++) {
    var normalized = normalizeLinkerToken_(titles[i]);
    if (!normalized) continue;
    var firstToken = normalized.split(' ')[0];
    // One- and two-letter tokens match far too much ordinary prose.
    if (firstToken.length < 3) continue;
    index[firstToken] = true;
  }
  return index;
}

/**
 * True if a line could plausibly contain a reference.
 */
function lineLooksLikeReference_(line, titleIndex) {
  var text = String(line || '');
  if (!text.trim()) return false;

  // Numeric citation: "1:1", "59b", "2, 3-4", "Ch. 12"
  if (/\d+\s*[:.]\s*\d+/.test(text)) return true;
  if (/\b\d{1,3}[ab]\b/.test(text)) return true;

  // Hebrew abbreviation with gershayim (ב"מ, רמב"ם) or a geresh (ר׳).
  if (/[א-ת][״"][א-ת]/.test(text)) return true;
  if (/[א-ת][׳']/.test(text)) return true;

  // Hebrew chapter:verse using Hebrew numerals separated by a colon.
  if (/[א-ת]{1,3}\s*[:׃]\s*[א-ת]{1,3}/.test(text)) return true;

  if (!titleIndex) return false;

  // A known book title token. Split on anything that is not a letter so
  // punctuation around a citation does not hide the title.
  var tokens = normalizeLinkerToken_(text).split(/[^0-9a-zא-ת]+/);
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    if (token && token.length >= 3 && titleIndex[token]) {
      return true;
    }
  }

  return false;
}

/**
 * Merge overlapping or adjacent [start, end) ranges.
 */
function mergeLinkerRanges_(ranges) {
  if (!ranges.length) return [];
  var sorted = ranges.slice().sort(function (a, b) { return a.start - b.start; });
  var merged = [sorted[0]];
  for (var i = 1; i < sorted.length; i++) {
    var last = merged[merged.length - 1];
    var next = sorted[i];
    if (next.start <= last.end) {
      last.end = Math.max(last.end, next.end);
    } else {
      merged.push(next);
    }
  }
  return merged;
}

/**
 * Build the payload to send to /api/find-refs, plus the segment table needed
 * to translate offsets in that payload back to offsets in the document.
 *
 * @param {string} documentText  The full document body text.
 * @param {Array<string>} titles Known Sefaria titles (from returnTitles()).
 * @returns {{payload: string, segments: Array<{docStart: number, payloadStart: number, length: number}>, scannedChars: number, totalChars: number}}
 */
function buildLinkerScanPayload_(documentText, titles) {
  var text = String(documentText || '');
  var titleIndex = buildLinkerTitleIndex_(titles);

  var candidateRanges = [];
  var lineStart = 0;
  var lines = text.split('\n');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (lineLooksLikeReference_(line, titleIndex)) {
      candidateRanges.push({
        start: Math.max(0, lineStart - LINKER_WINDOW_PADDING_),
        end: Math.min(text.length, lineStart + line.length + LINKER_WINDOW_PADDING_)
      });
    }
    lineStart += line.length + 1; // +1 for the '\n' that split() removed
  }

  var merged = mergeLinkerRanges_(candidateRanges);

  var segments = [];
  var parts = [];
  var payloadCursor = 0;

  for (var j = 0; j < merged.length; j++) {
    var range = merged[j];
    var slice = text.substring(range.start, range.end);
    if (!slice) continue;
    if (parts.length) {
      payloadCursor += LINKER_SEGMENT_SEPARATOR_.length;
      parts.push(LINKER_SEGMENT_SEPARATOR_);
    }
    segments.push({
      docStart: range.start,
      payloadStart: payloadCursor,
      length: slice.length
    });
    parts.push(slice);
    payloadCursor += slice.length;
  }

  var payload = parts.join('');

  return {
    payload: payload,
    segments: segments,
    scannedChars: payload.length,
    totalChars: text.length
  };
}

/**
 * Translate an offset in the scan payload back to a document offset.
 * Returns -1 when the offset falls in a separator (i.e. a match that spanned
 * two non-adjacent windows), which the caller must discard rather than
 * mis-place a hyperlink.
 */
function mapPayloadOffsetToDocOffset_(segments, payloadOffset) {
  if (!Array.isArray(segments)) return -1;
  var offset = Number(payloadOffset);
  if (!isFinite(offset) || offset < 0) return -1;

  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    if (offset >= segment.payloadStart && offset < segment.payloadStart + segment.length) {
      return segment.docStart + (offset - segment.payloadStart);
    }
  }
  return -1;
}

/**
 * Which window contains this payload offset? -1 when it lands in a join.
 */
function findLinkerSegmentIndex_(segments, offset) {
  for (var i = 0; i < segments.length; i++) {
    var segment = segments[i];
    if (offset >= segment.payloadStart && offset < segment.payloadStart + segment.length) {
      return i;
    }
  }
  return -1;
}

/**
 * Translate a [startChar, endChar) match from payload space to document space.
 *
 * Two different things can happen when a match runs past the end of its window,
 * and they deserve different answers:
 *
 *   1. The overrun lands in the SEPARATOR between windows. Sefaria's matcher
 *      routinely includes trailing whitespace in a citation's character range,
 *      and the separator is whitespace, so the citation itself sits entirely
 *      inside this window. Clamp to the window's end and place the link — an
 *      earlier version dropped these, losing links it could have placed exactly.
 *
 *   2. The overrun reaches real text in a LATER window. Then the "match" is
 *      text stitched together from two non-adjacent parts of the document by
 *      the join; no contiguous span of the document contains it. Return null.
 *      There is nothing to link and nothing meaningful to offer the reader —
 *      placing it would hyperlink the wrong words.
 */
function mapPayloadRangeToDocRange_(segments, payloadStart, payloadEndExclusive) {
  if (!Array.isArray(segments)) return null;

  var start = Number(payloadStart);
  var endExclusive = Number(payloadEndExclusive);
  if (!isFinite(start) || !isFinite(endExclusive) || start < 0 || endExclusive <= start) {
    return null;
  }

  var index = findLinkerSegmentIndex_(segments, start);
  if (index < 0) return null;

  var segment = segments[index];
  var segmentEndExclusive = segment.payloadStart + segment.length;

  if (endExclusive > segmentEndExclusive) {
    var next = segments[index + 1];
    if (next && (endExclusive - 1) >= next.payloadStart) {
      return null; // case 2 — stitched across the join
    }
  }

  var effectiveEnd = Math.min(endExclusive, segmentEndExclusive);
  if (effectiveEnd <= start) return null;

  return {
    startChar: segment.docStart + (start - segment.payloadStart),
    endChar: segment.docStart + (effectiveEnd - segment.payloadStart)
  };
}
