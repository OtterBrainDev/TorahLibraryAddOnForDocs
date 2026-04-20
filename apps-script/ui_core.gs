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
