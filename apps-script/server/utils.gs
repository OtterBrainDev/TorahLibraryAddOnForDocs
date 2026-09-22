// Utility module: shared primitives that don't fit any single domain.
// - include(): standard Apps Script HTML template helper used by every template
//   via `<?!= include('path/to/partial'); ?>`. Missing breaks ALL template rendering.
// - decodeHTMLEntities(): called from insertRichTextFromHTML in insertion.gs to
//   unescape the HTML entities that Sefaria returns inside text payloads.

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Named entities Sefaria is known to emit. Hebrew texts in particular use the
// typographic spaces (&thinsp; between words and before sof pasuq) and the
// bidi marks; anything missing from this table lands in the document verbatim.
const HTML_NAMED_ENTITIES_ = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', hairsp: ' ',
  zwnj: '‌', zwj: '‍', lrm: '‎', rlm: '‏',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•',
  ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'", laquo: '«', raquo: '»',
  shy: ''
};

// No-break space is rendered as a plain space: Docs wraps and justifies on it
// like any other space, and a literal U+00A0 surprises users who search or
// replace in the inserted text.
const HTML_ENTITY_OUTPUT_OVERRIDES_ = { nbsp: ' ' };

function decodeHTMLEntities(text) {
  if (!text || typeof text !== 'string') return text;
  // Sefaria occasionally double-escapes a spacing entity (`&amp;thinsp;`).
  // Collapse only those, so a deliberately escaped `&amp;lt;` stays `&lt;`.
  const unDoubled = text.replace(/&amp;(nbsp|ensp|emsp|thinsp|hairsp|zwnj|zwj|lrm|rlm|shy);/gi, '&$1;');
  // One pass, so each entity is decoded exactly once: a sequential chain that
  // decodes &amp; first turns `&amp;lt;` into `<`.
  return unDoubled.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);/g, function (match, body) {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!(code > 0) || code > 0x10FFFF) return match;
      if (code === 0xA0) return ' ';
      return String.fromCodePoint(code);
    }
    const name = body.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(HTML_ENTITY_OUTPUT_OVERRIDES_, name)) {
      return HTML_ENTITY_OUTPUT_OVERRIDES_[name];
    }
    if (Object.prototype.hasOwnProperty.call(HTML_NAMED_ENTITIES_, name)) {
      return HTML_NAMED_ENTITIES_[name];
    }
    return match;
  });
}
