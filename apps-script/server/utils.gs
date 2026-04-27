// Utility module: shared primitives that don't fit any single domain.
// - include(): standard Apps Script HTML template helper used by every template
//   via `<?!= include('path/to/partial'); ?>`. Missing breaks ALL template rendering.
// - decodeHTMLEntities(): called from insertRichTextFromHTML in insertion.gs to
//   unescape the HTML entities that Sefaria returns inside text payloads.

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function decodeHTMLEntities(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, '\'')
    .replace(/&rsquo;/g, '\'')
    .replace(/&#(\d+);/g, function(match, dec) {
      return String.fromCharCode(parseInt(dec, 10));
    })
    .replace(/&#x([a-fA-F0-9]+);/g, function(match, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    });
}
