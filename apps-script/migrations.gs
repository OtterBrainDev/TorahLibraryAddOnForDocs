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
var PREFS_SCHEMA_CURRENT_ = '8';

function runUserPreferenceMigrationsIfNeeded_() {
  var userProperties = PropertiesService.getUserProperties();
  var current = userProperties.getProperty(PREFS_SCHEMA_KEY_);
  if (current === PREFS_SCHEMA_CURRENT_) {
    return false;
  }

  // Compare numerically against the version the user is ON, so each migration
  // states the single fact that matters ("run this when coming from below N").
  // The previous form chained `current !== '4' && current !== '5'` guards,
  // which happened to work but had to be edited in two places for every new
  // version — and silently re-ran the newest migration for any version above
  // it. Absent/unparseable version means "oldest": run everything.
  var from = Number(current);
  if (!isFinite(from)) {
    from = 0;
  }

  // v1 -> v2: cover opt-in gates added by the rewrite that turned existing
  // behavior off for upgraders.
  if (from < 2) {
    migrateToV2_(userProperties);
  }
  // v2 -> v3: AI feature was detached; remove any stored AI state.
  if (from < 3) {
    migrateToV3_(userProperties);
  }
  // v3 -> v4: introduces `link_sources_insert_after_linking` (new behavior for
  // the Link Texts with Sefaria quick action). The default is intentionally
  // `false` because this is a NEW feature, not a gate on existing behavior —
  // existing users keep their current "link only" behavior unchanged. We still
  // record the explicit value so stored state and the code default stay aligned.
  if (from < 4) {
    migrateToV4_(userProperties);
  }
  // v4 -> v5: introduces `insert_from_selection_at_top`. Defaults to false —
  // a new UI preference, not a gate on existing behavior, so existing users
  // keep the current menu layout unchanged.
  if (from < 5) {
    migrateToV5_(userProperties);
  }
  // v5 -> v6: introduces `preserve_source_emphasis`, defaulting to TRUE. This
  // one is a gate on behavior the source intended and the add-on was
  // destroying, so upgraders get it ON — the same reasoning as the v2
  // divine-name migration, and the reason it is not a `false` opt-in.
  if (from < 6) {
    migrateToV6_(userProperties);
  }
  // v6 -> v7: introduces `linker_scan_mode`, defaulting to "candidates".
  //
  // This one DOES change existing behavior: "Link Texts with Sefaria" used to
  // upload the whole document body, and upgraders will now upload only the
  // windows that look like references. That is a deliberate privacy decision
  // rather than a new feature gate — uploading a user's entire document was
  // never disclosed to them — and the trade-off (slightly lower recall on
  // unusual citation forms) is reversible from Preferences. Called out loudly
  // in docs/CHANGELOG.md.
  if (from < 7) {
    migrateToV7_(userProperties);
  }
  // v7 -> v8: per-role text/background colour, plus the emphasis mapping.
  // Every one of these is a no-op default (no colour; emphasis renders as
  // itself), so nothing changes for anyone until they open Preferences. The
  // migration exists because hard rule #1 requires every new key to have one,
  // and because writing the values explicitly keeps stored state and code
  // defaults from drifting.
  if (from < 8) {
    migrateToV8_(userProperties);
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

function migrateToV5_(userProperties) {
  if (userProperties.getProperty('insert_from_selection_at_top') == null) {
    userProperties.setProperty('insert_from_selection_at_top', 'false');
  }
  return true;
}

/**
 * V6: introduces `preserve_source_emphasis`. Sefaria's own markup carries
 * meaning — the Steinsaltz Talmud bolds the Talmud's words to separate them
 * from Steinsaltz's interpolated explanation — and the insertion path was
 * flattening it. Existing users get `true`, because the emphasis was always
 * meant to be there; the previous behavior was a bug, not a preference.
 */
function migrateToV6_(userProperties) {
  if (userProperties.getProperty('preserve_source_emphasis') == null) {
    userProperties.setProperty('preserve_source_emphasis', 'true');
  }
  return true;
}

/**
 * V7: introduces `linker_scan_mode`. See the driver comment above for why the
 * default is "candidates" rather than preserving the old whole-document upload.
 */
function migrateToV7_(userProperties) {
  if (userProperties.getProperty('linker_scan_mode') == null) {
    userProperties.setProperty('linker_scan_mode', 'candidates');
  }
  return true;
}

/**
 * V8: per-role colour/background, and the source-emphasis mapping.
 *
 * Colour defaults are the EMPTY STRING, which every consumer reads as "leave
 * the document's own formatting alone". Defaulting to "#000000" would force
 * black text on every existing user, including anyone using a themed or dark
 * document — a silent, document-wide restyle on upgrade.
 */
function migrateToV8_(userProperties) {
  var noOpDefaults = {
    hebrew_font_color: '',
    hebrew_font_background: '',
    translation_font_color: '',
    translation_font_background: '',
    transliteration_font_color: '',
    transliteration_font_background: '',
    source_title_font_color: '',
    source_title_font_background: '',
    sefaria_link_font_color: '',
    sefaria_link_font_background: '',
    // Identity mapping: bold renders as bold, italic as italic. Same as the
    // behavior shipped with the v6 preserve-emphasis fix.
    emphasis_bold_style: 'bold',
    emphasis_bold_color: '',
    emphasis_bold_background: '',
    emphasis_bold_font: '',
    emphasis_italic_style: 'italic',
    emphasis_italic_color: '',
    emphasis_italic_background: '',
    emphasis_italic_font: ''
  };

  for (var key in noOpDefaults) {
    if (userProperties.getProperty(key) == null) {
      userProperties.setProperty(key, noOpDefaults[key]);
    }
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
