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
driver function `runUserPreferenceMigrationsIfNeeded_()` is the entry
point for the stored preferences; it is safe to call from any event
handler. The steps themselves are `applyMigrationsFrom_`, which also
brings a stored settings profile forward when it comes back into use
(server/settings-profiles.gs): a migration must work on any object with
getProperty / setProperty / deleteProperty, and on a store that holds
only a profile's keys.
*/

var PREFS_SCHEMA_KEY_ = 'prefs_schema_version';
var PREFS_SCHEMA_CURRENT_ = '35';

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
  // No schema version at all means a user this add-on has never set up: the
  // published add-on stored no preferences, and every run of this one stamps
  // the version. Save the defaults for them now, so that a default changed in
  // a later release never moves a user who is already using the add-on.
  if (current == null) {
    seedDefaultPreferences_(userProperties);
  }

  var from = Number(current);
  if (!isFinite(from)) {
    from = 0;
  }

  applyMigrationsFrom_(userProperties, from);
  userProperties.setProperty(PREFS_SCHEMA_KEY_, PREFS_SCHEMA_CURRENT_);
  return true;
}

/**
 * Every migration after schema `from`, in order, on `userProperties` (any
 * object with getProperty / setProperty / deleteProperty). The driver above
 * runs it on the stored preferences; a stored settings profile is brought
 * forward through it too when it comes back into use
 * (migrateProfileValues_ in server/settings-profiles.gs), so a value whose
 * meaning a later schema changes is migrated wherever it is kept.
 */
function applyMigrationsFrom_(userProperties, from) {
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
  // v8 -> v9: introduces `linker_review_mode`, defaulting to "summary".
  //
  // This changes behaviour for existing users, deliberately. The published
  // add-on links the first candidate of an ambiguous citation without saying
  // so — an arbitrary choice presented as a result. "summary" keeps every
  // unambiguous link automatic and only asks about the genuine ties, so the
  // interruption is proportional to the actual uncertainty. "quiet" restores
  // the old non-interactive flow (now with honest counts).
  if (from < 9) {
    migrateToV9_(userProperties);
  }
  // v9 -> v10: `menu_layout` replaces `insert_from_selection_at_top`. The old
  // toggle could only pin one item; the Menu Bar tab now orders and nests the
  // whole menu. A user who had pinned the item keeps it pinned; everyone else
  // gets the unchanged default menu. The old key is removed so no dead
  // preference outlives its last reader.
  if (from < 10) {
    migrateToV10_(userProperties);
  }
  // v10 -> v11: introduces `insert_from_selection_replace`, defaulting to TRUE.
  //
  // "Insert Source from Selection" originally replaced the selected citation
  // with the inserted source. Commit fefe9b9 (2026-05) switched it, with no
  // setting, to keeping the selection and inserting below it, and users who
  // relied on the replace behaviour reported it as a regression. The
  // preference makes both available; the default restores the original.
  if (from < 11) {
    migrateToV11_(userProperties);
  }
  // v11 -> v12: no-op. The יהוה replacement default changed from ה' to יי, and
  // this step briefly pinned ה' for upgraders with no stored value. Dropped
  // before release: nobody upgrading from the published add-on has these
  // preferences stored, so pinning would only have denied them the new
  // default. Kept as a step so the schema number stays monotonic.
  if (from < 12) {
    migrateToV12_(userProperties);
  }
  // v12 -> v13: introduces `source_title_heading` ("normal", what titles have
  // always been). Hebrew, translation and transliteration font/size also
  // default to "match the document" now; as with v12, nothing is pinned for
  // upgraders — the published add-on stored none of these.
  if (from < 13) {
    migrateToV13_(userProperties);
  }
  // v13 -> v14: `source_emphasis_mode` ("keep" / "discard" / "only") replaces
  // the boolean `preserve_source_emphasis`, adding "keep only the source's bold
  // and italics". Nobody's output changes: "false" becomes "discard" and
  // everything else "keep", the old default. The old key is removed so no dead
  // preference outlives its last reader (same as v10).
  if (from < 14) {
    migrateToV14_(userProperties);
  }
  // v14 -> v15: introduces `search_corpus_order` and `search_corpus_excluded`
  // (text-search corpus ordering). Both default to "[]": direct match and
  // near matches stay on top, corpora follow the built-in library order, and
  // nothing is hidden — no existing results are gated off.
  if (from < 15) {
    migrateToV15_(userProperties);
  }
  // v15 -> v16: introduces `translation_language_typography` (per-language
  // translation formatting). "{}" means no language has its own formatting,
  // so every translation keeps the Translation settings it had.
  if (from < 16) {
    migrateToV16_(userProperties);
  }
  // v16 -> v17: introduces `hidden_translation_languages` ("[]": every
  // language stays listed) and `show_unavailable_translations` (false).
  // The latter is a deliberate change for upgraders: translations with no
  // text for the passage used to be listed as if they had some, and are now
  // left out. Nothing that inserted text before stops inserting it.
  if (from < 17) {
    migrateToV17_(userProperties);
  }
  // v17 -> v18: introduces `hebrew_punctuation` and `translation_punctuation`.
  // Both default to "true" (punctuation shown), what every insert has always
  // had, so no upgrader's text changes until they switch one off.
  if (from < 18) {
    migrateToV18_(userProperties);
  }
  // v18 -> v19: introduces `bilingual_aligned_rows` (side-by-side layouts,
  // one table row per line). "false" keeps the one-row table every
  // side-by-side insert has had; the new layout is there to switch on.
  if (from < 19) {
    migrateToV19_(userProperties);
  }
  // v19 -> v20: introduces `ui_mode`, `first_run_setup` and
  // `menu_layout_before_simple`. Everyone with a schema already uses the
  // add-on: Full mode (what they have now) and setup marked done. A user with
  // no schema was seeded above with "pending", which this never overwrites.
  if (from < 20) {
    migrateToV20_(userProperties);
  }
  // v20 -> v21: introduced `hebrew_mark_fallback`, retired in v22 before it
  // was released. Kept so the numbering stays unbroken; it does nothing.
  if (from < 21) {
    migrateToV21_(userProperties);
  }
  // v21 -> v22: retires `hebrew_mark_fallback`. Borrowing the Hebrew marks a
  // font lacks from Noto is no longer a setting; it always happens. Removes
  // the stored value test builds wrote.
  if (from < 22) {
    migrateToV22_(userProperties);
  }
  // v22 -> v23: the source (Hebrew) title gets its own link switch and fonts
  // (`insert_hebrew_sefaria_link_default`, `hebrew_title_*`, `hebrew_link_*`).
  // Each starts as a copy of the translation title's setting, which until now
  // applied to both titles, so no upgrader's inserts change.
  if (from < 23) {
    migrateToV23_(userProperties);
  }
  // v23 -> v24: introduces `sefaria_link_format_override` and
  // `hebrew_link_format_override` ("true": a linked title keeps its linked
  // style, as it always has), and gives cantillation a real Torah-only
  // filter, so a legacy stored `teamim_filter = "torah"`, which always read
  // as "tanakh", is rewritten to "tanakh".
  if (from < 24) {
    migrateToV24_(userProperties);
  }
  // v24 -> v25: introduces the citation style (`citation_font`,
  // `citation_font_size`, `citation_font_style`, `citation_font_color`,
  // `citation_font_background`), each set to the citation's fixed look until
  // now (8 pt italic, the font of the text above).
  if (from < 25) {
    migrateToV25_(userProperties);
  }
  // v25 -> v26: introduces `sefaria_link_edition_label` and
  // `hebrew_link_edition_label` ("Name the edition"), set on, so a linked
  // title keeps naming its edition as it always has.
  if (from < 26) {
    migrateToV26_(userProperties);
  }
  // v26 -> v27: introduces `lexicon_dictionary_order` and
  // `lexicon_dictionary_excluded`, both "[]": the built-in order, nothing
  // hidden.
  if (from < 27) {
    migrateToV27_(userProperties);
  }
  // v27 -> v28: introduces `voices_topic_order` and `voices_topic_excluded`,
  // both "[]": the built-in order, nothing hidden.
  if (from < 28) {
    migrateToV28_(userProperties);
  }
  // v28 -> v29: Preferences → Sidebar and settings profiles. Introduces
  // `show_voices_tab` and `show_lexicon_tab` (set on: every user has the
  // tabs, and Simple mode now shows them too), `sidebar_quick_actions_hidden`
  // and `sidebar_options_hidden` ("[]": every button and control shows), and
  // `settings_profiles` ("": no profiles yet).
  if (from < 29) {
    migrateToV29_(userProperties);
  }
  // v29 -> v30: introduces `transliteration_position` ("below": under the
  // Hebrew, where the transliteration has always gone). "Line by line"
  // (`bilingual_aligned_rows`) now also applies to Stacked; its stored value
  // is left as it is.
  if (from < 30) {
    migrateToV30_(userProperties);
  }
  // v30 -> v31: introduces `transliteration_divine_name` ("HaShem": how the
  // transliteration has always written the Name).
  if (from < 31) {
    migrateToV31_(userProperties);
  }
  // v31 -> v32: seed the Notes preference when no choice was stored.
  // Earlier builds already seeded Omit; those stored choices are preserved.
  if (from < 32) {
    migrateToV32_(userProperties);
  }
  // v32 -> v33: make the Voices and Lexicon fallback choices explicit.
  // Reset, settings files and profiles now share the same defaults; readers
  // who already chose a mode keep it. Repair the generated "undefined"
  // sentinel from older profile snapshots, which is not a valid choice.
  if (from < 33) {
    migrateToV33_(userProperties);
  }
  // v34: new optional optical Hebrew scaling, off to preserve existing formatting.
  if (from < 34) migrateToV34_(userProperties);
  if (from < 35) migrateToV35_(userProperties);
}

/**
 * Write every default preference the user has no stored value for. Never
 * overwrites a stored value. Called on install and on the first run of a user
 * onInstall never reached (e.g. an admin-installed add-on).
 *
 * `menu_layout` is left out on purpose: an unset layout tracks the code
 * default, so new menu items keep appearing (see migrateToV10_).
 * Depends on getDefaultPreferences in server/preferences.gs (one global scope
 * at runtime).
 */
var SEED_EXCLUDED_PREFERENCES_ = ['menu_layout'];

function seedDefaultPreferences_(userProperties) {
  var defaults = getDefaultPreferences();
  var wrote = false;
  Object.keys(defaults).forEach(function(key) {
    if (SEED_EXCLUDED_PREFERENCES_.indexOf(key) >= 0) return;
    if (userProperties.getProperty(key) != null) return;
    userProperties.setProperty(key, String(defaults[key]));
    wrote = true;
  });
  return wrote;
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

/**
 * V9: introduces `linker_review_mode`. See the driver comment for why the
 * default is "summary" rather than preserving the silent first-candidate pick.
 */
function migrateToV9_(userProperties) {
  if (userProperties.getProperty('linker_review_mode') == null) {
    userProperties.setProperty('linker_review_mode', 'summary');
  }
  return true;
}

/**
 * V10: converts `insert_from_selection_at_top` into `menu_layout`.
 *
 * `menu_layout` is written only when the user had customized the menu (pinned
 * the item). Everyone else is left unset, so they read the code default and
 * keep tracking it — a stored snapshot of the default would freeze today's
 * menu for them. Depends on server/menu-layout.gs (one global scope at
 * runtime).
 */
function migrateToV10_(userProperties) {
  if (userProperties.getProperty('menu_layout') == null &&
      userProperties.getProperty('insert_from_selection_at_top') === 'true') {
    var layout = getDefaultMenuLayout_();
    layout.top = layout.top.filter(function(id) { return id !== 'insert_from_selection'; });
    layout.top.unshift('insert_from_selection');
    userProperties.setProperty('menu_layout', JSON.stringify(layout));
  }
  try { userProperties.deleteProperty('insert_from_selection_at_top'); } catch (_e) { /* ignore */ }
  return true;
}

/**
 * V11: introduces `insert_from_selection_replace`. See the driver comment for
 * why the default is "true" (replace) rather than the keep-selection behaviour
 * that shipped without a setting in fefe9b9.
 */
function migrateToV11_(userProperties) {
  if (userProperties.getProperty('insert_from_selection_replace') == null) {
    userProperties.setProperty('insert_from_selection_replace', 'true');
  }
  return true;
}

/**
 * V12: intentionally empty — see the driver comment.
 */
function migrateToV12_(userProperties) {
  return false;
}

/**
 * V13: introduces `source_title_heading`. See the driver comment for why the
 * new "match the document" font defaults are not pinned for upgraders.
 */
function migrateToV13_(userProperties) {
  if (userProperties.getProperty('source_title_heading') == null) {
    userProperties.setProperty('source_title_heading', 'normal');
  }
  return true;
}

/**
 * V14: converts `preserve_source_emphasis` into `source_emphasis_mode`. See the
 * driver comment. A stored mode is never overwritten.
 */
function migrateToV14_(userProperties) {
  if (userProperties.getProperty('source_emphasis_mode') == null) {
    var legacy = userProperties.getProperty('preserve_source_emphasis');
    userProperties.setProperty('source_emphasis_mode', legacy === 'false' ? 'discard' : 'keep');
  }
  try { userProperties.deleteProperty('preserve_source_emphasis'); } catch (_e) { /* ignore */ }
  return true;
}

/**
 * V15: introduces the text-search corpus preferences.
 *
 * - `search_corpus_order`: JSON array of corpus keys. "[]" means the
 *   built-in order (near matches right after the pinned direct match,
 *   then Sefaria's library order).
 * - `search_corpus_excluded`: JSON array of corpus keys hidden from text
 *   search results. "[]" hides nothing, so upgraders see every corpus
 *   they saw before. A stored value is never overwritten.
 */
function migrateToV15_(userProperties) {
  if (userProperties.getProperty('search_corpus_order') == null) {
    userProperties.setProperty('search_corpus_order', '[]');
  }
  if (userProperties.getProperty('search_corpus_excluded') == null) {
    userProperties.setProperty('search_corpus_excluded', '[]');
  }
  return true;
}

/**
 * V16: introduces `translation_language_typography`, a JSON map from a
 * translation language to its own font, size and style. "{}" (no entries)
 * leaves every translation formatted by the Translation settings, as before.
 * A stored value is never overwritten.
 */
function migrateToV16_(userProperties) {
  if (userProperties.getProperty('translation_language_typography') == null) {
    userProperties.setProperty('translation_language_typography', '{}');
  }
  return true;
}

/**
 * V17: translation-list preferences.
 *
 * - `hidden_translation_languages`: JSON array of language codes left out of
 *   the sidebar's search language filter and translation version list. "[]"
 *   hides nothing, so upgraders see every language they saw before.
 * - `show_unavailable_translations`: false. A translation listed for the book
 *   but empty for the passage (Yiddish on Deuteronomy 6:4) was offered as if
 *   it had text, and picking it inserted nothing. It is now left out; true
 *   lists it greyed out. A stored value is never overwritten.
 */
function migrateToV17_(userProperties) {
  if (userProperties.getProperty('hidden_translation_languages') == null) {
    userProperties.setProperty('hidden_translation_languages', '[]');
  }
  if (userProperties.getProperty('show_unavailable_translations') == null) {
    userProperties.setProperty('show_unavailable_translations', 'false');
  }
  return true;
}

/**
 * V18: introduces `hebrew_punctuation` and `translation_punctuation`. "true"
 * keeps the punctuation every insert has always had. A stored value (an
 * explicit "false" included) is never overwritten.
 */
function migrateToV18_(userProperties) {
  if (userProperties.getProperty('hebrew_punctuation') == null) {
    userProperties.setProperty('hebrew_punctuation', 'true');
  }
  if (userProperties.getProperty('translation_punctuation') == null) {
    userProperties.setProperty('translation_punctuation', 'true');
  }
  return true;
}

/**
 * V19: introduces `bilingual_aligned_rows`. "false" keeps the whole passage in
 * one table row, as every side-by-side insert so far. Nothing an upgrader had
 * is turned off: this is a new layout, not a gate on an old one. A stored
 * value is never overwritten.
 */
function migrateToV19_(userProperties) {
  if (userProperties.getProperty('bilingual_aligned_rows') == null) {
    userProperties.setProperty('bilingual_aligned_rows', 'false');
  }
  return true;
}

/**
 * V20: introduces `ui_mode`, `first_run_setup` and `menu_layout_before_simple`
 * (first-run setup and Simple mode; see docs/first-run-setup-design.md).
 * Upgraders keep the full interface they have and are never shown first-run
 * setup. A stored value is never overwritten, so a no-schema user, seeded with
 * `first_run_setup = "pending"` before migrations run, still sees setup.
 */
function migrateToV20_(userProperties) {
  if (userProperties.getProperty('ui_mode') == null) {
    userProperties.setProperty('ui_mode', 'full');
  }
  if (userProperties.getProperty('first_run_setup') == null) {
    userProperties.setProperty('first_run_setup', 'done');
  }
  if (userProperties.getProperty('menu_layout_before_simple') == null) {
    userProperties.setProperty('menu_layout_before_simple', '');
  }
  return true;
}

/**
 * V21: introduced `hebrew_mark_fallback`, which v22 retired before any
 * release. A no-op: v22 would only delete what it wrote.
 */
function migrateToV21_(userProperties) {
  return true;
}

/**
 * V22: retires `hebrew_mark_fallback`. The Hebrew marks a font has no glyph
 * for are always set in a Noto Hebrew (server/hebrew-fonts.gs); there is no
 * switch, so a stored value (from a test build) is removed rather than left
 * for nothing to read.
 */
function migrateToV22_(userProperties) {
  try { userProperties.deleteProperty('hebrew_mark_fallback'); } catch (_e) { /* ignore */ }
  return true;
}

/**
 * V23: the source (Hebrew) title is set apart from the translation title.
 * Every new key copies the stored value of the key that used to govern both
 * titles, or takes its default when there is none. A stored value is never
 * overwritten (a no-schema user was seeded with the defaults, which equal
 * the translation title's).
 */
var V23_TITLE_KEY_COPIES_ = {
  insert_hebrew_sefaria_link_default: 'insert_sefaria_link_default',
  hebrew_title_font: 'source_title_font',
  hebrew_title_font_size: 'source_title_font_size',
  hebrew_title_font_style: 'source_title_font_style',
  hebrew_title_font_color: 'source_title_font_color',
  hebrew_title_font_background: 'source_title_font_background',
  hebrew_link_font: 'sefaria_link_font',
  hebrew_link_font_size: 'sefaria_link_font_size',
  hebrew_link_font_style: 'sefaria_link_font_style',
  hebrew_link_font_color: 'sefaria_link_font_color',
  hebrew_link_font_background: 'sefaria_link_font_background'
};

function migrateToV23_(userProperties) {
  var defaults = getDefaultPreferences();
  Object.keys(V23_TITLE_KEY_COPIES_).forEach(function(key) {
    if (userProperties.getProperty(key) != null) return;
    var from = userProperties.getProperty(V23_TITLE_KEY_COPIES_[key]);
    userProperties.setProperty(key, from != null ? from : String(defaults[key]));
  });
  return true;
}

/**
 * V24: the two "Hyperlink formatting override" switches start on, which is
 * what linked titles have always looked like, and a legacy "torah"
 * cantillation filter keeps meaning what it meant ("tanakh") now that
 * "torah" means the Five Books only. A stored switch is never overwritten.
 */
function migrateToV24_(userProperties) {
  ['sefaria_link_format_override', 'hebrew_link_format_override'].forEach(function(key) {
    if (userProperties.getProperty(key) == null) userProperties.setProperty(key, 'true');
  });
  if (String(userProperties.getProperty('teamim_filter') || '').toLowerCase() === 'torah') {
    userProperties.setProperty('teamim_filter', 'tanakh');
  }
  return true;
}

/**
 * V25: the citation style, set to the look the citation always had. A stored
 * value is never overwritten.
 */
function migrateToV25_(userProperties) {
  var defaults = getDefaultPreferences();
  ['citation_font', 'citation_font_size', 'citation_font_style', 'citation_font_color', 'citation_font_background'].forEach(function(key) {
    if (userProperties.getProperty(key) == null) userProperties.setProperty(key, String(defaults[key]));
  });
  return true;
}

/**
 * V26: the two "Name the edition" switches start on: a linked title has
 * always read "Genesis 1:1 (Translation • Edition)". A stored switch is never
 * overwritten.
 */
function migrateToV26_(userProperties) {
  ['sefaria_link_edition_label', 'hebrew_link_edition_label'].forEach(function(key) {
    if (userProperties.getProperty(key) == null) userProperties.setProperty(key, 'true');
  });
  return true;
}

/**
 * V27: introduces the Lexicon dictionary preferences, the dictionaries'
 * counterpart of V15's corpus preferences.
 *
 * - `lexicon_dictionary_order`: JSON array of dictionary keys. "[]" means the
 *   built-in order (Klein, BDB, BDB Aramaic, Jastrow, Strong's, Ben-Yehuda).
 * - `lexicon_dictionary_excluded`: JSON array of dictionary keys whose entries
 *   the Lexicon leaves out. "[]" hides nothing, so upgraders see every
 *   dictionary they saw before. A stored value is never overwritten.
 */
function migrateToV27_(userProperties) {
  if (userProperties.getProperty('lexicon_dictionary_order') == null) {
    userProperties.setProperty('lexicon_dictionary_order', '[]');
  }
  if (userProperties.getProperty('lexicon_dictionary_excluded') == null) {
    userProperties.setProperty('lexicon_dictionary_excluded', '[]');
  }
  return true;
}

/**
 * V28: introduces the Voices topic preferences: the source sheets' topic
 * categories, ordered and hidden like V15's corpora and V27's dictionaries.
 *
 * - `voices_topic_order`: JSON array of topic keys. "[]" means the built-in
 *   order (Torah Portions, Shabbat & Holidays, Prayer, … Other).
 * - `voices_topic_excluded`: JSON array of topic keys whose sheets Voices
 *   leaves out. "[]" hides nothing, so upgraders see every sheet they saw
 *   before. A stored value is never overwritten.
 */
function migrateToV28_(userProperties) {
  if (userProperties.getProperty('voices_topic_order') == null) {
    userProperties.setProperty('voices_topic_order', '[]');
  }
  if (userProperties.getProperty('voices_topic_excluded') == null) {
    userProperties.setProperty('voices_topic_excluded', '[]');
  }
  return true;
}

/**
 * V29: Preferences → Sidebar, and settings profiles. The sidebar's Voices and
 * Lexicon tabs get a switch each, set on: every user has had the tabs (Full
 * mode always showed them; Simple mode hid them while in Texts and now shows
 * them), so a missing value never hides one. Nothing is hidden among the
 * Quick Actions buttons or the Insertion Options controls, as before, and no
 * profile exists. A stored value is never overwritten.
 */
var V29_DEFAULTS_ = {
  show_voices_tab: 'true',
  show_lexicon_tab: 'true',
  sidebar_quick_actions_hidden: '[]',
  sidebar_options_hidden: '[]',
  settings_profiles: ''
};

function migrateToV29_(userProperties) {
  Object.keys(V29_DEFAULTS_).forEach(function(key) {
    if (userProperties.getProperty(key) == null) userProperties.setProperty(key, V29_DEFAULTS_[key]);
  });
  return true;
}

/**
 * V30: the transliteration can have a column of its own in the side-by-side
 * layouts. `transliteration_position` is set to "below", under the Hebrew in
 * its own column, which is where every insert has put it until now. A stored
 * value is never overwritten.
 */
function migrateToV30_(userProperties) {
  if (userProperties.getProperty('transliteration_position') == null) {
    userProperties.setProperty('transliteration_position', 'below');
  }
  return true;
}

/**
 * V31: the transliteration's spelling of the Name can be chosen
 * (Preferences -> Insertion -> Transliteration Mapping).
 * `transliteration_divine_name` is set to "HaShem", which every
 * transliteration has written until now. A stored value is never overwritten.
 */
function migrateToV31_(userProperties) {
  if (userProperties.getProperty('transliteration_divine_name') == null) {
    userProperties.setProperty('transliteration_divine_name', 'HaShem');
  }
  return true;
}

/** V32: never overwrite a reader's explicit Notes choice. */
function migrateToV32_(userProperties) {
  if (userProperties.getProperty('source_notes_mode') != null) return false;
  userProperties.setProperty('source_notes_mode', 'separate');
  return true;
}

/** V33: seed workflow choices and repair only the old generated sentinel. */
function migrateToV33_(userProperties) {
  var defaults = {
    voices_insert_mode_default: 'reference',
    voices_translit_default: 'none',
    lexicon_insert_mode_default: 'entry'
  };
  var wrote = false;
  Object.keys(defaults).forEach(function (key) {
    var current = userProperties.getProperty(key);
    if (current != null && current !== 'undefined') return;
    userProperties.setProperty(key, defaults[key]);
    wrote = true;
  });
  return wrote;
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


function migrateToV34_(userProperties) {
  if (userProperties.getProperty('auto_scale_hebrew') != null) return false;
  userProperties.setProperty('auto_scale_hebrew', 'false');
  return true;
}

/** Restore Unlink Sources in shipped presets without rewriting custom menus. */
function migrateToV35_(userProperties) {
  var oldSimple = getDefaultMenuLayout_();
  oldSimple.hidden = ['voices', 'lexicon', 'quick_actions_sidebar', 'unlink_sources', 'gematriya_count', 'surprise_me'];
  var oldFactory = {"top":["texts","voices","lexicon","insert_from_selection","quick_actions","link_texts","transform_divine_names","-","surprise_me"],"quick_actions":["quick_actions_sidebar","-","unlink_sources","-","gematriya_count"],"hidden":["voices","lexicon","quick_actions_sidebar","unlink_sources","gematriya_count","surprise_me","quick_actions","insert_from_selection"]};
  var presets = [oldSimple, oldFactory].map(function (layout) {
    return JSON.stringify(normalizeMenuLayout_(layout));
  });
  var wrote = false;
  ['menu_layout', 'menu_layout_before_simple'].forEach(function (key) {
    var stored = userProperties.getProperty(key);
    if (!stored) return;
    var layout = normalizeMenuLayout_(stored);
    var preset = presets.indexOf(JSON.stringify(layout));
    if (preset < 0) return;
    layout.hidden = layout.hidden.filter(function (id) { return id !== 'unlink_sources'; });
    if (preset === 1) {
      var unlinkIndex = layout.quick_actions.indexOf('unlink_sources');
      layout.quick_actions.splice(unlinkIndex, 2); // Unlink Sources and the adjacent divider.
      layout.top.splice(layout.top.indexOf('transform_divine_names') + 1, 0, 'unlink_sources');
    }
    userProperties.setProperty(key, JSON.stringify(layout));
    wrote = true;
  });
  return wrote;
}
