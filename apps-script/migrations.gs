/*
Schema migrations for UserProperties.

A "migration" is a one-shot write that brings an already-installed user
forward to the preference shape the current code expects. Run at
`onOpen` (when safe) and on first sidebar bootstrap, idempotent in both
places, keyed by `prefs_schema_version`.

Why this file exists: in the cleanup that restored this add-on, we
discovered that the rewrite branch had introduced new gate preferences
(`apply_sheimot_on_insertion`, and the family of `ai_*_default` keys)
defaulting to `false` for existing users. That silently disabled
behavior they previously had. See docs/regression-log.md for the full
story. Every future preference addition that gates existing behavior
must land with a migration here AND a row in the regression log.

Contract: each `migrateToV<N>_` function takes a `UserProperties`
handle and returns true if it wrote anything, false otherwise. The
driver function `runUserPreferenceMigrationsIfNeeded_()` is the only
public entry point; it is safe to call from any event handler.
*/

var PREFS_SCHEMA_KEY_ = 'prefs_schema_version';
var PREFS_SCHEMA_CURRENT_ = '4';

function runUserPreferenceMigrationsIfNeeded_() {
  var userProperties = PropertiesService.getUserProperties();
  var current = userProperties.getProperty(PREFS_SCHEMA_KEY_);
  if (current === PREFS_SCHEMA_CURRENT_) {
    return false;
  }

  if (!current) {
    migrateToV2_(userProperties);
  }
  // v2 -> v3: AI feature was detached; remove any stored AI state.
  if (current !== '3' && current !== '4') {
    migrateToV3_(userProperties);
  }
  // v3 -> v4: introduces `link_sources_insert_after_linking` (new
  // behavior for the Link Texts with Sefaria quick action). The
  // default is intentionally `false` because this is a NEW feature,
  // not a gate on existing behavior — existing users keep their
  // current "link only" behavior unchanged. We still record the
  // explicit value so the stored state and code default stay aligned.
  if (current !== '4') {
    migrateToV4_(userProperties);
  }

  userProperties.setProperty(PREFS_SCHEMA_KEY_, PREFS_SCHEMA_CURRENT_);
  return true;
}

/**
 * V2: cover for preferences that were added to the rewrite as opt-in
 * gates. Existing users had the un-gated behavior and should keep it.
 *
 * - `apply_sheimot_on_insertion`: when absent, turn ON so divine-name
 *   substitutions keep applying for upgraders.
 * - Any other opt-in defaults added in the rewrite should be listed
 *   here explicitly rather than blanket-enabled.
 */
function migrateToV2_(userProperties) {
  if (userProperties.getProperty('apply_sheimot_on_insertion') == null) {
    userProperties.setProperty('apply_sheimot_on_insertion', 'true');
  }
  return true;
}

/**
 * V3: the AI lesson feature was detached from the shipped add-on (see
 * docs/ai-lesson/DESIGN.md). Remove every AI-related key — both the
 * saved-API-key storage that never should have existed and the per-user
 * defaults that no longer have any consumers. This keeps the
 * UserProperties shape aligned with the shipped code and also makes the
 * user safer: stale plaintext keys disappear from PropertiesService on
 * first open after the upgrade.
 */
/**
 * V4: introduces `link_sources_insert_after_linking`. When the user
 * runs the "Link Texts with Sefaria" quick action with this enabled,
 * the action additionally inserts each linked source using the user's
 * default insertion preferences. Default is `false`: this is a new
 * feature, not a gate on existing behavior — leaving it off preserves
 * the legacy "link only" experience for upgrading users.
 */
function migrateToV4_(userProperties) {
  if (userProperties.getProperty('link_sources_insert_after_linking') == null) {
    userProperties.setProperty('link_sources_insert_after_linking', 'false');
  }
  return true;
}

function migrateToV3_(userProperties) {
  var aiKeys = [
    'experimental_ai_source_sheet_enabled',
    'ai_provider_default',
    'ai_model_default',
    'ai_key_strategy_default',
    'ai_audience_default',
    'ai_lesson_style_default',
    'ai_duration_default',
    'ai_user_key_openai',
    'ai_user_key_anthropic',
    'ai_user_key_gemini',
    'ai_managed_last_used_at_openai',
    'ai_managed_last_used_at_anthropic',
    'ai_managed_last_used_at_gemini'
  ];
  for (var i = 0; i < aiKeys.length; i++) {
    try { userProperties.deleteProperty(aiKeys[i]); } catch (_e) { /* ignore */ }
  }
  return true;
}
