/**
 * Shared UI config payload for HTML templates.
 */
function getUiAppConfig_(pageId, mode) {
  return {
    pageId: pageId || '',
    mode: mode || '',
    generatedAt: new Date().toISOString()
  };
}

// JSON safe to embed inside <script type="application/json">...</script>
// when printed via Apps Script's <?!= ?> raw output. Escaping "<" prevents
// "</script>" from ever appearing in the payload, no matter what the value
// contains. Line/paragraph separators are escaped defensively for older
// JSON.parse implementations.
function toEmbeddedJson_(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029');
}
