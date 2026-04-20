/*
Copyright 2014-2024 Shlomi Helfgot
Modifications copyright 2026 Austin Swafford
Licensed under the MIT License. See repository LICENSE.md.
כל המביא דבר בשם אומרו מביא גאולה לעולם
*/

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


const SETTINGS = [
  "apply_sheimot_on_insertion",
  "elodim_replace",
  "elodim_replacement",
  "extended_gemara",
  "god_replace",
  "god_replacement",
  "hebrew_font",
  "hebrew_font_size",
  "hebrew_font_style",
  "include_translation_source_info",
  "include_transliteration_default",
  "insert_citation_default",
  "insert_sefaria_link_default",
  "link_texts_default",
  "show_line_markers_default",
  "output_mode_default",
  "bilingual_layout_default",
  "last_translation_languages",
  "last_translation_only_filter",
  "last_search_sort_mode",
  "last_search_relevance_sort",
  "meforash_replace",
  "meforash_replacement",
  "nekudot",
  "nekudot_filter",
  "experimental_features_enabled",
  "surprise_me_enabled",
  "teamim",
  "teamim_filter",
  "translation_font",
  "translation_font_size",
  "translation_font_style",
  "preferred_translation_language",
  "transliteration_font",
  "transliteration_font_size",
  "transliteration_font_style",
  "transliteration_scheme",
  "transliteration_overrides",
  "transliteration_is_biblical_hebrew",
  "transliteration_biblical_dagesh_mode",
  "versioning",
  "yaw_replace",
  "yaw_replacement",
  "source_title_font",
  "source_title_font_size",
  "source_title_font_style",
  "sefaria_link_font",
  "sefaria_link_font_size",
  "sefaria_link_font_style",
  "search_mode",
  "experimental_ai_source_sheet_enabled",
  "ai_provider_default",
  "ai_model_default",
  "ai_key_strategy_default",
  "ai_audience_default",
  "ai_lesson_style_default",
  "ai_duration_default"
];

function onInstall() {
	  const initialPrefs = {
    "apply_sheimot_on_insertion": false,
    "elodim_replace": false,
    "extended_gemara": false,
    "god_replace": false,
    "god_replacement": "G-d",
    "preferred_translation_language": "en",
    "hebrew_font": "Noto Sans Hebrew",
    "hebrew_font_size": 18,
    "hebrew_font_style": "normal",
    "include_translation_source_info": false,
    "include_transliteration_default": false,
    "insert_sefaria_link_default": true,
    "show_line_markers_default": true,
    "output_mode_default": "both",
    "bilingual_layout_default": "he-right",
    "meforash_replace": false,
    "nekudot": true,
    "nekudot_filter": "always",
    "surprise_me_enabled": false,
    "teamim": true,
    "teamim_filter": "available",
    "translation_font": "Noto Sans Hebrew",
    "translation_font_size": 11,
    "translation_font_style": "normal",
    "transliteration_font": "Noto Sans Hebrew",
    "transliteration_font_size": 11,
    "transliteration_font_style": "italic",
    "transliteration_scheme": "traditional",
    "transliteration_overrides": "{}",
    "transliteration_is_biblical_hebrew": true,
    "transliteration_biblical_dagesh_mode": "none",
    "versioning": true,
    "yaw_replace": false,
    "search_mode": "texts",
    "experimental_ai_source_sheet_enabled": false,
    "ai_provider_default": "default",
    "ai_model_default": "",
    "ai_key_strategy_default": "auto"
  };
  setPreferences(initialPrefs);
  //display release notes in popup
  
  let html = HtmlService.createHtmlOutputFromFile('release-notes')
      .setWidth(720)
      .setHeight(760);
  DocumentApp.getUi().showModalDialog(html, 'Release Notes');
}

let extendedGemaraPreference = false;

function onOpen(e) {
  const ui = DocumentApp.getUi();
  const addOnMenu = ui.createAddonMenu();
  const quickActionsMenu = ui.createMenu('Quick Actions')
      .addItem('Transform Divine Names', 'transformDivineNames')
      .addItem('Link Texts with Sefaria', 'linkTextsWithSefaria');

  let experimentalAiEnabled = false;
  let surpriseEnabled = false;

  // Per Google Workspace add-on guidance, avoid reading PropertiesService while
  // the add-on is still in AuthMode.NONE so the menu always renders.
  if (!e || e.authMode !== ScriptApp.AuthMode.NONE) {
    const prefs = getPreferences();
    experimentalAiEnabled = prefs.experimental_ai_source_sheet_enabled == "true";
    surpriseEnabled = prefs.surprise_me_enabled == "true";
  }

  if (experimentalAiEnabled) {
    quickActionsMenu.addSeparator()
      .addItem("Today's Daf Lesson (45 min)", 'runQuickActionTodaysDafLessonMenu')
      .addItem("Today's 929 Lesson (45 min)", 'runQuickActionTodays929LessonMenu')
      .addItem("This Week's Parashah Lesson (45 min)", 'runQuickActionThisWeeksParashahLessonMenu');
  }

  addOnMenu
      .addItem('Texts', 'textsHTML')
      .addItem('Voices', 'voicesHTML')
      .addSubMenu(quickActionsMenu);

  if (experimentalAiEnabled) {
    addOnMenu.addSeparator().addItem('Generate Shiur Draft (experimental)', 'openAiLessonGenerator');
  }
  if (surpriseEnabled) {
    addOnMenu.addSeparator().addItem('Surprise Me', 'surpriseMeHTML');
  }

  addOnMenu
      .addSeparator()
      .addItem('Preferences', 'preferencesPopup')
      .addItem('Support', 'supportPopup')
      .addToUi();
}

function setSearchMode_(mode) {
  const normalizedMode = (mode === 'voices' || mode === 'experimental') ? mode : 'texts';
  PropertiesService.getUserProperties().setProperty('search_mode', normalizedMode);
  return normalizedMode;
}

function getSearchMode_() {
  const stored = PropertiesService.getUserProperties().getProperty('search_mode');
  return (stored === 'voices' || stored === 'experimental') ? stored : 'texts';
}

function openSharedSidebar_(mode) {
  var resolvedMode = setSearchMode_(mode || getSearchMode_());
  var template = HtmlService.createTemplateFromFile('sidebar');
  template.initialMode = resolvedMode;
  template.appConfigJson = JSON.stringify(getUiAppConfig_('sidebar', resolvedMode));
  var output = template.evaluate()
    .setTitle(resolvedMode === 'voices' ? 'Voices' : 'Texts')
    .setWidth(300);
  DocumentApp.getUi().showSidebar(output);
  extendedGemaraPreference = PropertiesService.getUserProperties().getProperty("extended_gemara");
}

function textsHTML() {
  openSharedSidebar_('texts');
}

function voicesHTML() {
  openSharedSidebar_('voices');
}

function getSidebarBootstrapData(mode, sessionId) {
  const accountPreferences = getAccountPreferences();
  const resolvedMode = (mode === 'voices' || mode === 'experimental' || mode === 'texts') ? mode : getSearchMode_();
  const resolvedSessionId = sessionId || generateSidebarSessionId_();
  const sessionState = resolvedMode === 'texts' ? getSidebarSessionState(resolvedSessionId) : {};
  const effectivePreferences = Object.assign({}, accountPreferences, sessionState);
  return {
    mode: resolvedMode,
    sessionId: resolvedSessionId,
    accountPreferences: accountPreferences,
    sessionState: sessionState,
    effectivePreferences: effectivePreferences,
    preferences: effectivePreferences
  };
}

function supportPopup() {
  let html = HtmlService.createHtmlOutputFromFile('support')
      .setWidth(760)
      .setHeight(860);
  DocumentApp.getUi().showModalDialog(html, 'Support');
}

function releaseNotesPopup() {
  var html = HtmlService.createHtmlOutputFromFile('release-notes')
    .setWidth(700)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, 'Release Notes');
}


function howItWorksPopup() {
  const html = HtmlService.createHtmlOutputFromFile('help')
      .setWidth(760)
      .setHeight(860);
  DocumentApp.getUi().showModalDialog(html, 'User Guide');
}

function aboutPopup() {
  const html = HtmlService.createHtmlOutputFromFile('support')
      .setWidth(760)
      .setHeight(860);
  DocumentApp.getUi().showModalDialog(html, 'About');
}

//returns the user preference w.r.t. displaying the versioning dropdowns in the insertion module
function getVersioningPreference() {
  try {
    const userProperties = PropertiesService.getUserProperties(); 
    return userProperties.getProperty("versioning");
  } catch (error) {
    Logger.log(`The system has made a mach'ah: ${error.message}`);
    return true;
  }
}


function normalizeReferenceInput(reference) {
  let normalized = String(reference || '').trim();
  if (!normalized) {
    return '';
  }

  normalized = normalized
    .replace(/[־‐-―]/g, '-')
    .replace(/[“”„‟″״]/g, '"')
    .replace(/[‘’‚‛′׳]/g, "'")
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/\u05C3/g, ':')
    .replace(/\s*[:：]\s*/g, ':')
    .replace(/\s*[-–—]\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize common Hebrew numeral punctuation: א׳:א׳-ב׳ => א:א-ב
  normalized = normalized
    .replace(/([\u0590-\u05FF])['"׳״]+(?=[\s:.-]|$)/g, '$1')
    .replace(/([\u0590-\u05FF])['"׳״]+(?=[\u0590-\u05FF])/g, '$1');

  normalized = normalized.replace(/([֐-׿])\s+([֐-׿])/g, '$1 $2');
  return normalized;
}

function findRefsInDocumentText(documentText) {
  const payload = {
    text: {
      title: '',
      body: String(documentText || '')
    }
  };

  try {
    const enqueueResponse = UrlFetchApp.fetch('https://www.sefaria.org/api/find-refs', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const enqueueData = JSON.parse(enqueueResponse.getContentText() || '{}');
    const taskId = enqueueData.task_id;
    if (!taskId) {
      return [];
    }

    for (let attempt = 0; attempt < 12; attempt++) {
      Utilities.sleep(400);
      const statusResponse = UrlFetchApp.fetch(`https://www.sefaria.org/api/async/${encodeURIComponent(taskId)}`, { muteHttpExceptions: true });
      const statusData = JSON.parse(statusResponse.getContentText() || '{}');
      if (!statusData.ready) {
        continue;
      }
      const body = (((statusData || {}).result || {}).body || {});
      return Array.isArray(body.results) ? body.results : [];
    }
  } catch (error) {
    Logger.log(`Failed to fetch find-refs output: ${error.message}`);
  }

  return [];
}

function resolveReferenceWithFallbacks(reference, versions) {
  const candidates = [];
  const normalized = normalizeReferenceInput(reference);
  if (normalized) {
    candidates.push(normalized);
  }
  const original = String(reference || '').trim();
  if (original && candidates.indexOf(original) < 0) {
    candidates.push(original);
  }

  for (let i = 0; i < candidates.length; i++) {
    const resolved = findReference(candidates[i], versions, true);
    if (resolved && resolved.ref && !resolved.error) {
      return resolved;
    }
  }

  return;
}

function findReference(reference, versions=undefined, skipNormalization=false) {
  // Technical debt: this resolver still fails hard on incomplete/partial refs (e.g. "Shemo" before "Shemot").
  // We should return structured "incomplete reference" states instead of relying on exception flow.
  //reference = "Shemot 12:1"; /* this is a test harness */
  let safeReference = String(reference || '').trim();
  if (!safeReference) {
    return;
  }
  if (!skipNormalization) {
    return resolveReferenceWithFallbacks(safeReference, versions);
  }

  Logger.log(`Reference: ${safeReference}`);
  let url = 'https://www.sefaria.org/api/texts/'
  
  let encodedReference = encodeURIComponent(safeReference);

  if (versions) {
    let encodedEnVersion = encodeURIComponent(versions.en || "");
    let encodedHeVersion = encodeURIComponent(versions.he || "");
    let versionedAdditions = `${encodedReference}?ven=${encodedEnVersion}&vhe=${encodedHeVersion}&commentary=0&context=0`;
    url = url + versionedAdditions;
  }
  else {
    let nonVersionedAdditions = `${encodedReference}?commentary=0&context=0`;
    url = url + nonVersionedAdditions;
  }

  // patch for now; triggered when an invalid sefer name is sent
  try {
    let response = UrlFetchApp.fetch(url);
    let data = JSON.parse(response.getContentText());
  
  /*although it might make more sense to put the filters (orthography, seamus) elsewhere, as it is text processing, 
  all representations of this data need to have these applied to them such that the preview is נאמן to what the actual
  ref will look like when inserted*/

  // Technical debt: this try/catch currently wraps both fetch + text normalization + parsing.
  // Narrowing the protected region would make failures easier to reason about.

    const userProperties = PropertiesService.getUserProperties();
    data = applyHebrewDisplayPreferences(data, userProperties);
    data = applyHebrewDivineNamePreferences(data, userProperties);
    applyEnglishDivineNamePreference(data, userProperties);
    return data;

  } catch (error) {
    // return nothing
    Logger.log(`The system has made a macha'ah: ${error.message} from url ${url}`)
    return; 
  }

}

function normalizeHebrewDisplayFilters_(userProperties) {
  const nekudotEnabled = userProperties.getProperty("nekudot") != "false";
  const rawNekudotFilter = String(userProperties.getProperty("nekudot_filter") || "always").toLowerCase();
  const nekudotFilter = (rawNekudotFilter === "tanakh" || rawNekudotFilter === "never") ? rawNekudotFilter : "always";

  const teamimEnabled = userProperties.getProperty("teamim") != "false";
  const rawTeamimFilter = String(userProperties.getProperty("teamim_filter") || "available").toLowerCase();
  const teamimFilter = (rawTeamimFilter === "tanakh" || rawTeamimFilter === "torah") ? "tanakh" : (rawTeamimFilter === "never" ? "never" : "available");

  return {
    nekudotEnabled,
    nekudotFilter,
    teamimEnabled,
    teamimFilter
  };
}

function applyHebrewTextDisplayPreferences(value, context, filters) {
  if (Array.isArray(value)) {
    return value.map(function(item) {
      return applyHebrewTextDisplayPreferences(item, context, filters);
    });
  }
  if (value === null || value === undefined || typeof value !== 'string') {
    return value;
  }

  let output = value;
  const shouldStripNekudot = !filters.nekudotEnabled || (filters.nekudotFilter === 'tanakh' && context !== 'Tanakh');
  const shouldStripTeamim = !filters.teamimEnabled || (filters.teamimFilter === 'tanakh' && context !== 'Tanakh');

  if (shouldStripTeamim) {
    output = output.replace(/[֑-֯]/g, '');
  }
  if (shouldStripNekudot) {
    output = output.replace(/[ְ-ֽ]/g, '');
    output = output.replace(/[ֿ-ׇ]/g, '');
  }

  return output;
}

function applyHebrewDisplayPreferences(data, userProperties) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const filters = normalizeHebrewDisplayFilters_(userProperties);
  const context = data.type || '';
  const clone = JSON.parse(JSON.stringify(data));

  ['he', 'heRef'].forEach(function(field) {
    if (Object.prototype.hasOwnProperty.call(clone, field)) {
      clone[field] = applyHebrewTextDisplayPreferences(clone[field], context, filters);
    }
  });

  return clone;
}

function applyHebrewDivineNamePreferences(data, userProperties) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const meforashReplacement = userProperties.getProperty("meforash_replacement");
  const replacements = [];

  if (userProperties.getProperty("meforash_replace") == "true" && meforashReplacement) {
    replacements.push({ pattern: /י[֑-ׇ]*ה[֑-ׇ]*ו[֑-ׇ]*ה[֑-ׇ]*/g, replacement: meforashReplacement });
  }
  if (userProperties.getProperty("yaw_replace") == "true") {
    replacements.push({ pattern: /י[֑-ׇ]*ה[֑-ׇ]*/g, replacement: userProperties.getProperty("yaw_replacement") || '' });
  }
  if (userProperties.getProperty("elodim_replace") == "true") {
    replacements.push({ pattern: /א[֑-ׇ]*ל[֑-ׇ]*ו[֑-ׇ]*ה[֑-ׇ]*י[֑-ׇ]*ם[֑-ׇ]*/g, replacement: userProperties.getProperty("elodim_replacement") || '' });
  }

  if (!replacements.length) {
    return data;
  }

  const applyReplacements = function(node) {
    if (Array.isArray(node)) {
      return node.map(function(value) { return applyReplacements(value); });
    }
    if (typeof node === 'string') {
      return replacements.reduce(function(current, rule) {
        return current.replace(rule.pattern, rule.replacement);
      }, node);
    }
    return node;
  };

  const clone = JSON.parse(JSON.stringify(data));
  ['he', 'heRef'].forEach(function(field) {
    if (Object.prototype.hasOwnProperty.call(clone, field)) {
      clone[field] = applyReplacements(clone[field]);
    }
  });
  return clone;
}

function applyEnglishDivineNamePreference(data, userProperties) {
  if (!data || userProperties.getProperty("god_replace") != "true") {
    return;
  }

  const replacement = userProperties.getProperty("god_replacement") || "G-d";
  const replaceInNode = (node) => {
    if (Array.isArray(node)) {
      return node.map((value) => replaceInNode(value));
    }
    if (typeof node === 'string') {
      return node.replace(/\bGod\b/g, replacement);
    }
    return node;
  };

  data.text = replaceInNode(data.text);
}

function getTypographySettings() {
  const userProperties = PropertiesService.getUserProperties();
  return {
    hebrewFont: userProperties.getProperty("hebrew_font") || "Noto Sans Hebrew",
    hebrewFontSize: Number(userProperties.getProperty("hebrew_font_size") || 18),
    hebrewFontStyle: userProperties.getProperty("hebrew_font_style") || "normal",
    translationFont: userProperties.getProperty("translation_font") || "Noto Sans Hebrew",
    translationFontSize: Number(userProperties.getProperty("translation_font_size") || 12),
    translationFontStyle: userProperties.getProperty("translation_font_style") || "normal",
    transliterationFont: userProperties.getProperty("transliteration_font") || "Noto Sans Hebrew",
    transliterationFontSize: Number(userProperties.getProperty("transliteration_font_size") || 12),
    transliterationFontStyle: userProperties.getProperty("transliteration_font_style") || "italic",
    sourceTitleFont: userProperties.getProperty("source_title_font") || "Noto Sans Hebrew",
    sourceTitleFontSize: Number(userProperties.getProperty("source_title_font_size") || 14),
    sourceTitleFontStyle: userProperties.getProperty("source_title_font_style") || "normal",
    sefariaLinkFont: userProperties.getProperty("sefaria_link_font") || "Noto Sans Hebrew",
    sefariaLinkFontSize: Number(userProperties.getProperty("sefaria_link_font_size") || 14),
    sefariaLinkFontStyle: userProperties.getProperty("sefaria_link_font_style") || "underline"
  };
}

function applyTypographyToParagraph(paragraph, font, size, style) {
  if (!paragraph) {
    return;
  }

  const text = paragraph.editAsText();
  const len = text.getText().length;
  if (len <= 0) {
    return;
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
}

function applyTitleTypography(paragraph, typography, insertSefariaLink) {
  applyTypographyToParagraph(
    paragraph,
    insertSefariaLink ? typography.sefariaLinkFont : typography.sourceTitleFont,
    insertSefariaLink ? typography.sefariaLinkFontSize : typography.sourceTitleFontSize,
    insertSefariaLink ? typography.sefariaLinkFontStyle : typography.sourceTitleFontStyle
  );
}

function insertTransliterationParagraphAfter(doc, index, transliterationText, typography, ltr) {
  if (!transliterationText) {
    return;
  }
  let paragraph = doc.insertParagraph(index, transliterationText);
  paragraph.setLeftToRight(ltr !== false);
  paragraph.setAttributes({});
  applyTypographyToParagraph(paragraph, typography.transliterationFont, typography.transliterationFontSize, typography.transliterationFontStyle);
}

function insertTransliterationIntoCell(cell, transliterationText, typography) {
  if (!cell || !transliterationText) {
    return;
  }
  let paragraph = cell.insertParagraph(cell.getNumChildren(), transliterationText);
  paragraph.setLeftToRight(true);
  paragraph.setAttributes({});
  applyTypographyToParagraph(paragraph, typography.transliterationFont, typography.transliterationFontSize, typography.transliterationFontStyle);
}

function testRef() {
  findReference("Shemot 12:2", {"en": "The Holy Scriptures: A New Translation (JPS 1917)", "he": "Yehoyesh's Yiddish Tanakh Translation [yi]"})
}


function normalizeTransliterationLineMarkersToGematria(text, startingVerse) {
  if (!text) {
    return text;
  }
  let verseNumber = Number(startingVerse) || 1;
  return String(text).split('\n').map(function(line) {
    if (!line || !line.trim()) return line;
    if (/^\s*\([^)]*\)\s*/.test(line)) {
      const marker = (typeof gematriya === 'function') ? gematriya(verseNumber, { punctuate: false }) : String(verseNumber);
      verseNumber += 1;
      return line.replace(/^\s*\([^)]*\)\s*/, "(" + marker + ") ");
    }
    return line;
  }).join('\n');
}

function formatDataForPesukim(data, pesukim) {
  const hasLineMarkerableContent = (value) => {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.some((item) => Array.isArray(item) || typeof item === 'string');
  };

  const lineMarkersAvailable = hasLineMarkerableContent(data.he) || hasLineMarkerableContent(data.text);
  data.lineMarkersAvailable = lineMarkersAvailable;
  data.lineMarkersApplied = !!(lineMarkersAvailable && pesukim);

  let heTextWrapper = "", enTextWrapper = "", fromVerse = (data["sections"][1]) ? data["sections"][1] : 1;
  
  function addHebrewVerse(text, wrapper, pesukim, number) {
    let editedText = text;
    if(pesukim) {
        editedText = "("+gematriya(number, {punctuate: false})+") "+text+"\n";
    } else {
        editedText = text + "\n";
    }
    wrapper+=editedText;
    return wrapper;
  }
  function addEnglishVerse(text, wrapper, pesukim, number) {
    let editedText = text;
      if(pesukim) {
        editedText = "("+number+") "+text+"\n";
      } else {
        editedText = text + "\n";
      };
      wrapper+=editedText;
      return wrapper;
  }

  if(data.isSpanning) {
    data.he.forEach(function(perekText, perekNum) {
      if(typeof perekText == "object") {
        perekText.forEach(function(verseText, index) {
         heTextWrapper = addHebrewVerse(verseText, heTextWrapper, pesukim, fromVerse+index)
        });
        fromVerse = 1;
      } else {
        heTextWrapper+=perekText;
      }
    });
    data.text.forEach(function(perekText, perekNum) {
      if(typeof perekText == "object") {
        perekText.forEach(function(verseText, index) {
         enTextWrapper = addEnglishVerse(verseText, enTextWrapper, pesukim, fromVerse+index)
        });
        fromVerse = 1;
      } else {
        enTextWrapper+=perekText;
      }
    });
  } else {
    if(typeof data.he == "object") {
      data.he.forEach(function(ele, index) {
        heTextWrapper = addHebrewVerse(ele, heTextWrapper, pesukim, fromVerse+index);
      });
    } else {
      heTextWrapper = data.he;
    }
    if(typeof data.text == "object") {
      data.text.forEach(function(ele, index) {
        enTextWrapper = addEnglishVerse(ele, enTextWrapper, pesukim, fromVerse+index);
      });
    } else {
      enTextWrapper = data.text;
    }
  }

  data.he = heTextWrapper;
  data.text = enTextWrapper;

  return data;
};

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

function buildCitationLines(data, preferredTitle, includeTranslationSourceInfo) {
  const titleLine = String((preferredTitle || (data && data.ref) || '')).trim();
  const lines = [];
  if (titleLine) lines.push(titleLine);

  const englishVersion = String((data && data.versionTitle) || '').trim();
  const englishSource = String((data && data.versionSource) || '').trim();
  const hebrewVersion = String((data && data.heVersionTitle) || '').trim();
  const hebrewSource = String((data && data.heVersionSource) || '').trim();
  const license = String((data && (data.license || data.licenseName || data.licenseString)) || '').trim();
  const author = String((data && (data.author || data.collectiveTitle || data.authors)) || '').trim();

  if (author) lines.push('Author: ' + author);
  if (includeTranslationSourceInfo && englishVersion) lines.push('Translation: ' + englishVersion);
  if (includeTranslationSourceInfo && englishSource) lines.push('Translation source: ' + englishSource);
  if (hebrewVersion) lines.push('Source edition: ' + hebrewVersion);
  if (hebrewSource) lines.push('Source edition URL: ' + hebrewSource);
  if (license) lines.push('License: ' + license);
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

function insertReference(data, singleLanguage = undefined, pasukPreference = true, preferredTitle = null, includeTranslationSourceInfo = false, bilingualLayout = "he-right", insertSefariaLink = false, includeTransliteration = false, insertCitationOnly = false) {
  if (!data || !data.ref) {
    throw new Error("Unable to insert source: no resolved reference.");
  }

  //set title as preferred title (e.g. Bereishit instead of Genesis) if exists
  let title = (preferredTitle) ? preferredTitle : data.ref;

  //add pesukim if user wants
  const includeLineMarkers = pasukPreference === true || pasukPreference === 'true';
  data = formatDataForPesukim(data, includeLineMarkers);

  let doc = DocumentApp.getActiveDocument().getBody();
  let docWrapper = DocumentApp.getActiveDocument();
  let cursor = docWrapper.getCursor();
  let selection = docWrapper.getSelection();
  let index = doc.getNumChildren();

  const resolveSafeSelectionInsertionIndex = () => {
    if (!selection) {
      return null;
    }

    let rangeElements = selection.getRangeElements();
    if (!rangeElements || rangeElements.length !== 1) {
      throw new Error("Could not insert at this selection. Select simple text in a single paragraph, or place the cursor where you want the source inserted.");
    }

    let rangeElement = rangeElements[0];
    if (!rangeElement || !rangeElement.isPartial()) {
      throw new Error("Could not insert at this selection. Select simple text in a single paragraph, or place the cursor where you want the source inserted.");
    }

    let element = rangeElement.getElement();
    if (!element || element.getType() !== DocumentApp.ElementType.TEXT) {
      throw new Error("Could not insert at this selection. Select plain paragraph text (not table/header/footer content), or place the cursor where you want the source inserted.");
    }

    let parent = element.getParent();
    if (!parent || (parent.getType() !== DocumentApp.ElementType.PARAGRAPH && parent.getType() !== DocumentApp.ElementType.LIST_ITEM)) {
      throw new Error("Could not insert at this selection. Select plain paragraph text, or place the cursor where you want the source inserted.");
    }

    let container = parent.getParent();
    if (container !== doc) {
      throw new Error("Could not insert at this selection. This add-on currently supports replacing selected body text only.");
    }

    let start = rangeElement.getStartOffset();
    let end = rangeElement.getEndOffsetInclusive();
    if (start < 0 || end < start) {
      throw new Error("Could not insert at this selection. Select plain paragraph text, or place the cursor where you want the source inserted.");
    }

    let textElement = element.asText();
    textElement.deleteText(start, end);
    return container.getChildIndex(parent) + 1;
  };

  if (!cursor && selection) {
    index = resolveSafeSelectionInsertionIndex();
  }

  if (cursor) {
    let currentElement = cursor.getElement();
    if (currentElement) {
      let paragraphParent = currentElement.getParent();
      if (paragraphParent) {
        //convert 0-index to 1-index
        index = paragraphParent.getChildIndex(currentElement) + 1;
      }
    }
  }
  /* ---- test harness --- 
  let index = doc.getNumChildren()-1;
  */

  let headerStyle = {};
        headerStyle[DocumentApp.Attribute.BOLD] = true;
        headerStyle[DocumentApp.Attribute.UNDERLINE] = true;
  let nullStyle = {};
        nullStyle[DocumentApp.Attribute.BOLD] = false;
        nullStyle[DocumentApp.Attribute.UNDERLINE] = false;
  let noUnderline = {};
    noUnderline[DocumentApp.Attribute.UNDERLINE] = false;

  let shouldIncludeEnglishAttribution = includeTranslationSourceInfo && singleLanguage != "he";
  let attributionLines = (shouldIncludeEnglishAttribution) ? getEnglishAttributionLines(data) : [];
  const typography = getTypographySettings();
  const currentPrefs = getPreferences();
  const transliterationScheme = currentPrefs.transliteration_scheme || "traditional";
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
    insertRichTextFromHTML(mainTextParagraph, mainText);
    mainTextParagraph.setAttributes(noUnderline);
    if (singleLanguage == "he") {
      mainTextParagraph.setAttributes(nullStyle);
    }
    mainTextParagraph.setLeftToRight(ltr);
    applyTypographyToParagraph(
      mainTextParagraph,
      singleLanguage == "he" ? typography.hebrewFont : typography.translationFont,
      singleLanguage == "he" ? typography.hebrewFontSize : typography.translationFontSize,
      singleLanguage == "he" ? typography.hebrewFontStyle : typography.translationFontStyle
    );

    if (singleLanguage == "he" && transliterationText) {
      insertTransliterationParagraphAfter(doc, index + 2, transliterationText, typography, true);
    }

    let singleLanguageNextIndex = index + 2;

    if (singleLanguage == "he" && transliterationText) {
      singleLanguageNextIndex += 1;
    }

    if (singleLanguage == "en" && attributionLines.length > 0) {
      let attributionParagraph = doc.insertParagraph(index + 2, "");
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
      applyTypographyToParagraph(hebTextParagraph, typography.hebrewFont, typography.hebrewFontSize, typography.hebrewFontStyle);

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
      applyTypographyToParagraph(engTextParagraph, typography.translationFont, typography.translationFontSize, typography.translationFontStyle);

      let heTopNextIndex = index + (transliterationText ? 5 : 4);

      if (shouldIncludeEnglishAttribution && attributionLines.length > 0) {
        let attributionParagraph = doc.insertParagraph(heTopNextIndex, "");
        insertAttributionParagraph(attributionParagraph, attributionLines);
        heTopNextIndex += 1;
      }

      appendCitationParagraph(heTopNextIndex);
    } else {
      /* note: since Hebrew text needs to be inserted in RTL order, we first insert the table without 
      the Hebrew text and then add in the Hebrew text manually, with the correct text-direction */
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
      applyTypographyToParagraph(engText, typography.translationFont, typography.translationFontSize, typography.translationFontStyle);

      let hebText = table.getCell(1, hebrewColumn)
        .setText("")
        .insertParagraph(0, "");
      hebText.setLeftToRight(false);
      hebText.setAttributes(nullStyle);
      insertRichTextFromHTML(hebText, data.he);
      hebText.setAttributes(noUnderline);
      applyTypographyToParagraph(hebText, typography.hebrewFont, typography.hebrewFontSize, typography.hebrewFontStyle);

      let sideBySideNextIndex = index + 1;

      if (shouldIncludeEnglishAttribution && attributionLines.length > 0) {
        let attributionParagraph = doc.insertParagraph(index + 1, "");
        insertAttributionParagraph(attributionParagraph, attributionLines);
        sideBySideNextIndex += 1;
      }

      appendCitationParagraph(sideBySideNextIndex);

      /* the constraints of insertParagraph mean that there will always be an extra line break in table cells to which we dynamically add text. See https://stackoverflow.com/questions/39506414/remove-newline-from-google-doc-table-content.
      This solution was contributed by an expert in Google Apps Script, @tanaike. Thanks @tanaike! [https://stackoverflow.com/questions/76647915/extra-spaces-when-inserting-text-in-google-docs-tables-rich-text-version?noredirect=1#comment135153775_76647915] */

      for (let r = 0; r < table.getNumRows(); r++) {
        const row = table.getRow(r);
        for (let c = 0; c < row.getNumCells(); c++) {
          const cell = row.getCell(c);
          const n = cell.getNumChildren();
          cell.getChild(n - 1).removeFromParent();
        }
      }

      // Insert transliteration after the cleanup loop so it isn't removed as a trailing empty paragraph
      if (transliterationText) {
        insertTransliterationIntoCell(table.getCell(1, hebrewColumn), transliterationText, typography);
      }
    }

  }

}

/*
converts an html string (returned from the Sefaria API) to rich-text (using the Google Docs API) and inserts it into the provided element.
violates encapsulation principles because Google Apps Script for some reason doesn't allow for headless rich text (e.g. new Text()...)
*/
function insertRichTextFromHTML(element, htmlString) {
  // Technical debt: text preprocessing concerns (e.g. translation cleanup) still live in the HTML parser path.
  // Long-term, preprocessing should be separated from tag-to-rich-text rendering.

  element = element.editAsText();
  let buf = [];
  let index = 0, italicsFnCount = 0, textLength = element.editAsText().getText().length;
  let bolded = false, italicized = false, inFootnote = false;


  if (Array.isArray(htmlString)) {
    htmlString = htmlString.join("");
  }
  let iterableString = htmlString.split(/(<\/?[a-zA-Z]+[a-zA-Z'"0-9= \-/]*>)/g);

  let inserterFn = (textModification) => {
    //grab all words in the buffer and join
    let snippet = buf.join("");

    //index of snippet needs to be zero-indexed. This is how we keep track of which words/phrases/sentences to bold/italicize
    let snippetLength = snippet.length;
    let snippetIndex = snippetLength - 1;

    if (snippet != "") {
      element.insertText(textLength, snippet);

      //set rich text settings
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

    /* example format of footnotes in the text: -----‘Do not let me see your faces<sup class=\"footnote-marker\">*</sup><i class=\"footnote\"><b>Do not let me see your faces </b>See note at v. 3.</i> unless----*/
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

    else if (word[0] == "<") {
      //grab the name of the tag
      let tagName = /<\/?([a-zA-Z]+)([a-zA-Z'"0-9= \-/])*>/.exec(word)[1];

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

  // add in the last words, if the text snippet does not end with a tag
  let snippet = buf.join("");
  if ( snippet != "" ) {
    element.insertText(textLength, snippet);
    let snippetIndex = snippet.length - 1;
    element.setBold(textLength, textLength+snippetIndex, false); 
    element.setItalic(textLength, textLength+snippetIndex, false);
  }
}


function getDefaultPreferences() {
  return {
    apply_sheimot_on_insertion: false,
    elodim_replace: false,
    elodim_replacement: "אלוקים",
    extended_gemara: false,
    god_replace: false,
    god_replacement: "G-d",
    preferred_translation_language: "en",
    hebrew_font: "Noto Sans Hebrew",
    hebrew_font_size: 18,
    hebrew_font_style: "normal",
    include_translation_source_info: false,
    include_transliteration_default: false,
    insert_citation_default: false,
    insert_sefaria_link_default: true,
    link_texts_default: false,
    show_line_markers_default: true,
    output_mode_default: "both",
    bilingual_layout_default: "he-right",
    last_translation_languages: JSON.stringify(["en"]),
    last_translation_only_filter: false,
    last_search_sort_mode: "relevance",
    last_search_relevance_sort: true,
    meforash_replace: false,
    meforash_replacement: "ה'",
    nekudot: true,
    nekudot_filter: "always",
    surprise_me_enabled: false,
    teamim: true,
    teamim_filter: "available",
    translation_font: "Noto Sans Hebrew",
    translation_font_size: 12,
    translation_font_style: "normal",
    transliteration_font: "Noto Sans Hebrew",
    transliteration_font_size: 12,
    transliteration_font_style: "italic",
    transliteration_scheme: "traditional",
    transliteration_overrides: "{}",
    transliteration_is_biblical_hebrew: true,
    transliteration_biblical_dagesh_mode: "none",
    versioning: true,
    yaw_replace: false,
    yaw_replacement: "קה",
    source_title_font: "Noto Sans Hebrew",
    source_title_font_size: 14,
    source_title_font_style: "normal",
    sefaria_link_font: "Noto Sans Hebrew",
    sefaria_link_font_size: 14,
    sefaria_link_font_style: "underline",
    search_mode: "texts",
    experimental_ai_source_sheet_enabled: false,
    ai_provider_default: "default",
    ai_model_default: "",
    ai_key_strategy_default: "auto",
    ai_audience_default: "Adult learners",
    ai_lesson_style_default: "Interactive shiur",
    ai_duration_default: 45
  };
}

function readUserPreferenceObject_() {
  const defaults = getDefaultPreferences();
  const preferences = PropertiesService.getUserProperties();
  const out = {};
  for (let i = 0; i < SETTINGS.length; i++) {
    const key = SETTINGS[i];
    const storedValue = preferences.getProperty(key);
    out[key] = (storedValue !== null && storedValue !== undefined) ? storedValue : defaults[key];
  }
  return out;
}

function generateSidebarSessionId_() {
  return Utilities.getUuid();
}

function getSidebarSessionCacheKey_(sessionId) {
  return 'sidebar_session_' + String(sessionId || 'default');
}

function getSidebarSessionState(sessionId) {
  if (!sessionId) return {};
  const raw = CacheService.getUserCache().get(getSidebarSessionCacheKey_(sessionId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (error) {
    return {};
  }
}

function setSidebarSessionState(sessionId, payload) {
  if (!sessionId) throw new Error('Missing sidebar session id.');
  const current = getSidebarSessionState(sessionId);
  const merged = Object.assign({}, current, payload || {});
  CacheService.getUserCache().put(getSidebarSessionCacheKey_(sessionId), JSON.stringify(merged), 21600);
  return merged;
}

function clearSidebarSessionState(sessionId) {
  if (sessionId) {
    CacheService.getUserCache().remove(getSidebarSessionCacheKey_(sessionId));
  }
  return true;
}

function getAccountPreferences() {
  return readUserPreferenceObject_();
}

function setAccountPreferences(preferenceObject) {
  setPreferences(preferenceObject || {});
  return getAccountPreferences();
}

function saveSidebarSessionAsAccountDefaults(sessionId) {
  const sessionState = getSidebarSessionState(sessionId);
  setPreferences(sessionState || {});
  clearSidebarSessionState(sessionId);
  return getAccountPreferences();
}

function getPreferences() {
  return getAccountPreferences();
}

function setPreferences(preferenceObject) {
  const userProperties = PropertiesService.getUserProperties();
  for (const property in (preferenceObject || {})) {
    try {
      userProperties.setProperty(property, preferenceObject[property]);
    } catch (error) {
      Logger.log(`The system has made a mach'ah: ${error.message}`);
    }
  }
  return getAccountPreferences();
}

function sefariaSearch() {
  textsHTML();
} 

function transformDivineNames() {
  const body = DocumentApp.getActiveDocument().getBody();
  const prefs = getPreferences();
  const noTransformsEnabled = [prefs.meforash_replace, prefs.yaw_replace, prefs.elodim_replace, prefs.god_replace]
    .every((value) => value != "true");
  if (noTransformsEnabled) {
    DocumentApp.getUi().alert('No divine-name transforms are enabled. Open Preferences and enable at least one transform before running this action.');
    return;
  }
  const hebrewMarks = "\\u0591-\\u05C7";
  const hebrewChars = "\\u0590-\\u05FF";
  const replaceRangesInTextElement = (textElement, ranges) => {
    if (!ranges || !ranges.length) {
      return;
    }

    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i];
      const start = range.start;
      const end = range.end;
      const replacement = range.replacement;
      const originalAttributes = textElement.getAttributes(start);
      const originalLink = textElement.getLinkUrl(start);

      textElement.deleteText(start, end);
      textElement.insertText(start, replacement);

      if (replacement.length > 0) {
        const replacementEnd = start + replacement.length - 1;
        textElement.setAttributes(start, replacementEnd, originalAttributes);
        textElement.setLinkUrl(start, replacementEnd, originalLink);
      }
    }
  };

  const replaceHebrewWordInTextElement = (textElement, tokenPattern, replacement) => {
    const source = textElement.getText();
    if (!source) {
      return;
    }
    const wrappedPattern = new RegExp(`(^|[^${hebrewChars}])(${tokenPattern})(?=$|[^${hebrewChars}])`, 'g');
    const ranges = [];
    let match;

    while ((match = wrappedPattern.exec(source)) !== null) {
      const prefix = match[1] || "";
      const token = match[2] || "";
      const tokenStart = match.index + prefix.length;
      const tokenEnd = tokenStart + token.length - 1;
      if (token.length > 0) {
        ranges.push({ start: tokenStart, end: tokenEnd, replacement });
      }
    }

    replaceRangesInTextElement(textElement, ranges);
  };

  const replaceRegexInTextElement = (textElement, regex, replacement) => {
    const source = textElement.getText();
    if (!source) {
      return;
    }
    const ranges = [];
    let match;

    while ((match = regex.exec(source)) !== null) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length - 1,
        replacement
      });
    }

    replaceRangesInTextElement(textElement, ranges);
  };

  const collectTextElements = (element, textElements) => {
    if (!element) {
      return;
    }

    if (element.getType && element.getType() === DocumentApp.ElementType.TEXT) {
      textElements.push(element.asText());
      return;
    }

    if (!element.getNumChildren) {
      return;
    }

    const count = element.getNumChildren();
    for (let i = 0; i < count; i++) {
      collectTextElements(element.getChild(i), textElements);
    }
  };

  const textElements = [];
  collectTextElements(body, textElements);

  textElements.forEach((textElement) => {
    if (prefs.meforash_replace == "true") {
      replaceHebrewWordInTextElement(textElement, `י[${hebrewMarks}]*ה[${hebrewMarks}]*ו[${hebrewMarks}]*ה[${hebrewMarks}]*`, prefs.meforash_replacement || "ה'");
    }
    if (prefs.yaw_replace == "true") {
      replaceHebrewWordInTextElement(textElement, `י[${hebrewMarks}]*ה[${hebrewMarks}]*`, prefs.yaw_replacement || "קה");
    }
    if (prefs.elodim_replace == "true") {
      replaceHebrewWordInTextElement(textElement, `א[${hebrewMarks}]*ל[${hebrewMarks}]*(?:ו[${hebrewMarks}]*)?ה[${hebrewMarks}]*י[${hebrewMarks}]*ם[${hebrewMarks}]*`, prefs.elodim_replacement || "אלוקים");
    }
    if (prefs.god_replace == "true") {
      replaceRegexInTextElement(textElement, /\bGod\b/g, prefs.god_replacement || "G-d");
    }
  });
}

function linkTextsWithSefaria() {
  const bodyText = DocumentApp.getActiveDocument().getBody().editAsText();
  const docText = bodyText.getText();
  const linkerMatches = findRefsInDocumentText(docText);
  let linkedCount = 0;
  linkerMatches.forEach((match) => {
    if (!match || match.linkFailed || !Array.isArray(match.refs) || !match.refs.length) {
      return;
    }
    const start = Number(match.startChar);
    const endExclusive = Number(match.endChar);
    if (!isFinite(start) || !isFinite(endExclusive)) {
      return;
    }
    const end = endExclusive - 1;
    if (start < 0 || end < start || end >= docText.length) {
      return;
    }
    if (bodyText.getLinkUrl(start) || bodyText.getLinkUrl(end)) {
      return;
    }
    const ref = String(match.refs[0] || '').trim();
    if (!ref) {
      return;
    }
    const url = `https://www.sefaria.org/${encodeURIComponent(ref).replace(/%20/g, '_')}`;
    bodyText.setLinkUrl(start, end, url);
    linkedCount++;
  });

  DocumentApp.getUi().alert(`Linked ${linkedCount} recognizable reference${linkedCount === 1 ? '' : 's'} to Sefaria.`);
}

function returnTitles() {
    let url = 'https://www.sefaria.org/api/index/titles/';
    let response = UrlFetchApp.fetch(url);
    let json = response.getContentText();
    let data = JSON.parse(json);
    let titleArray = data["books"];
    return titleArray;
}

function buildSearchWrapperPayload_(input, searchConfig) {
  let normalizedConfig = {};
  if (Array.isArray(searchConfig)) {
    normalizedConfig.filters = searchConfig;
  } else if (typeof searchConfig === 'boolean') {
    normalizedConfig.relevanceSort = searchConfig;
  } else if (searchConfig && typeof searchConfig === 'object') {
    normalizedConfig = searchConfig;
  }

  let safeFilters = Array.isArray(normalizedConfig.filters) ? normalizedConfig.filters.filter(Boolean) : [];
  let usePageRank = normalizedConfig.relevanceSort !== false;
  let searchOptions = {
    'aggs': [],
    'field': 'naive_lemmatizer',
    'filters': safeFilters,
    'filter_fields': Array(safeFilters.length).fill('path'),
    'query': String(input || '').trim(),
    'size': 50,
    'slop': 10,
    'type': 'text',
    'source_proj': true
  };

  if (usePageRank) {
    searchOptions.sort_fields = ['pagesheetrank'];
    searchOptions.sort_method = 'score';
    searchOptions.sort_reverse = false;
    searchOptions.sort_score_missing = 0.04;
  }

  return searchOptions;
}


function searchWrapperRequest_(payload) {
  let url = 'https://www.sefaria.org/api/search-wrapper';
  let postOptions = {
    method: 'post',
    payload: JSON.stringify(payload),
    contentType: 'application/json',
    muteHttpExceptions: true
  };

  let rawResponse = UrlFetchApp.fetch(url, postOptions);
  let statusCode = rawResponse.getResponseCode ? rawResponse.getResponseCode() : 200;
  let responseText = rawResponse.getContentText() || '{}';

  if (statusCode >= 400) {
    throw new Error('Search request failed with status ' + statusCode + '.');
  }

  return JSON.parse(responseText || '{}');
}

function normalizeSearchTranslationLanguages_(languages) {
  const languageLUT = {
    english: 'en', en: 'en', eng: 'en',
    spanish: 'es', es: 'es', spa: 'es',
    french: 'fr', fr: 'fr', fre: 'fr', fra: 'fr',
    german: 'de', de: 'de', ger: 'de', deu: 'de',
    russian: 'ru', ru: 'ru', rus: 'ru',
    arabic: 'ar', ar: 'ar', ara: 'ar',
    hebrew: 'he', he: 'he', heb: 'he'
  };
  return (Array.isArray(languages) ? languages : []).map(function(language) {
    const raw = String(language || '').trim().toLowerCase();
    return languageLUT[raw] || raw;
  }).filter(Boolean);
}

function searchHitHasTranslation_(hit, desiredLanguages) {
  let source = hit && hit._source ? hit._source : {};
  let selectedLanguages = normalizeSearchTranslationLanguages_(desiredLanguages);
  let availableLangs = [];
  if (source && Array.isArray(source.availableLangs)) {
    availableLangs = normalizeSearchTranslationLanguages_(source.availableLangs);
  } else if (source && Array.isArray(source.versions)) {
    availableLangs = normalizeSearchTranslationLanguages_(source.versions.map(function(version) {
      return version && version.language;
    }));
  }
  if (!selectedLanguages.length) {
    if (availableLangs.length) {
      return availableLangs.length > 0;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'hasEn')) {
      return source.hasEn !== false;
    }
    return true;
  }
  if (!availableLangs.length) {
    return selectedLanguages.indexOf('en') >= 0 && source.hasEn !== false;
  }
  return selectedLanguages.some(function(language) {
    return availableLangs.indexOf(language) >= 0;
  });
}

function findSearchAdvanced(input, filters, relevanceSort, translationOnly) {
  let searchConfig = (filters && typeof filters === 'object' && !Array.isArray(filters))
    ? filters
    : { filters: filters, relevanceSort: relevanceSort, translationOnly: translationOnly === true };

  let attempts = [];
  attempts.push(buildSearchWrapperPayload_(input, searchConfig));

  if (Array.isArray(searchConfig.filters) && searchConfig.filters.length > 0) {
    attempts.push(buildSearchWrapperPayload_(input, Object.assign({}, searchConfig, { filters: [] })));
  }

  if (searchConfig.relevanceSort !== false) {
    attempts.push(buildSearchWrapperPayload_(input, Object.assign({}, searchConfig, { relevanceSort: false })));
  }

  attempts.push({
    aggs: [],
    field: 'naive_lemmatizer',
    query: String(input || '').trim(),
    size: 50,
    slop: 10,
    type: 'text',
    source_proj: true
  });

  let lastError = null;
  for (let i = 0; i < attempts.length; i++) {
    try {
      let responseJSON = searchWrapperRequest_(attempts[i]);
      let hits = (((responseJSON || {}).hits || {}).hits || []);
      if (searchConfig.translationOnly) {
        hits = hits.filter(function(hit) {
          return searchHitHasTranslation_(hit, searchConfig.translationLanguages);
        });
      }
      return hits;
    } catch (error) {
      lastError = error;
      Logger.log('Search attempt ' + (i + 1) + ' failed: ' + error.message);
    }
  }

  throw new Error(lastError && lastError.message ? lastError.message : 'Search is temporarily unavailable. Please try again.');
}

function findSearch(input, filters, pageRank) {
  return findSearchAdvanced(input, filters, pageRank, false);
}

function getNameCandidates(query) {
  var safeQuery = String(query || '').trim();
  if (!safeQuery) return [];
  try {
    var url = 'https://www.sefaria.org/api/name/' + encodeURIComponent(safeQuery) + '?limit=6';
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    var statusCode = response.getResponseCode ? response.getResponseCode() : 200;
    if (statusCode >= 400) return [];
    var data = JSON.parse(response.getContentText() || '{}');
    var completions = Array.isArray(data.completions) ? data.completions : [];
    return completions.filter(function(c) { return typeof c === 'string' && c.trim(); }).slice(0, 6);
  } catch (e) {
    Logger.log('getNameCandidates failed: ' + e.message);
    return [];
  }
}

function searchVoices(query, options) {
  const safeQuery = String(query || '').trim();
  if (!safeQuery) {
    return [];
  }

  const payload = {
    from: 0,
    size: 24,
    highlight: {
      pre_tags: ['<b>'],
      post_tags: ['</b>'],
      fields: {
        content: { fragment_size: 180 },
        title: { fragment_size: 120 }
      }
    },
    query: {
      bool: {
        should: [
          { match_phrase: { title: { query: safeQuery, slop: 3 } } },
          { match_phrase: { content: { query: safeQuery, slop: 8 } } }
        ],
        minimum_should_match: 1
      }
    }
  };

  const response = UrlFetchApp.fetch('https://www.sefaria.org/api/search/sheet/_search', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status >= 400) {
    throw new Error('Voices search is temporarily unavailable.');
  }

  const json = JSON.parse(response.getContentText() || '{}');
  const hits = (((json || {}).hits || {}).hits || []);
  return hits.map(function(hit, index) {
    const source = (hit && hit._source) || {};
    const highlight = (hit && hit.highlight) || {};
    const snippet = (highlight.content && highlight.content[0]) || source.summary || '';
    const title = source.title || ('Sheet ' + (source.sheetId || index + 1));
    const url = source.sheetId ? ('https://www.sefaria.org/sheets/' + encodeURIComponent(source.sheetId)) : '';
    return {
      key: 'sheet-' + String(source.sheetId || hit._id || index),
      ref: 'sheet:' + String(source.sheetId || hit._id || index),
      label: title,
      subtitle: source.owner_name ? ('By ' + source.owner_name) : 'Source Sheet',
      snippet: snippet,
      summary: source.summary || '',
      owner: source.owner_name || '',
      ownerProfile: source.profile_url || '',
      url: url,
      sheetId: source.sheetId || null,
      topics: source.topics_en || [],
      typeLabel: 'Voices',
      clusterLabel: 'Source Sheets',
      kind: 'sheet',
      hasTranslation: true,
      availableLangs: ['en', 'he']
    };
  });
}

function insertSheetReference(sheetPayload) {
  if (!sheetPayload || !sheetPayload.url) {
    throw new Error('No sheet is selected.');
  }

  const document = DocumentApp.getActiveDocument();
  if (!document) {
    throw new Error('Open a Google Doc before inserting a sheet.');
  }

  const body = document.getBody();
  let index = body.getNumChildren();
  const cursor = document.getCursor();
  if (cursor) {
    const currentElement = cursor.getElement();
    if (currentElement && currentElement.getParent()) {
      index = currentElement.getParent().getChildIndex(currentElement) + 1;
    }
  }

  const title = String(sheetPayload.label || 'Sefaria Source Sheet').trim();
  const summary = String(sheetPayload.summary || '').trim();
  const owner = String(sheetPayload.owner || '').trim();
  const url = String(sheetPayload.url || '').trim();
  const topics = Array.isArray(sheetPayload.topics) ? sheetPayload.topics.filter(Boolean) : [];
  const typography = getTypographySettings();

  const titleParagraph = body.insertParagraph(index, title);
  titleParagraph.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  titleParagraph.editAsText().setLinkUrl(url);
  applyTitleTypography(titleParagraph, typography, true);

  if (summary) {
    const summaryParagraph = body.insertParagraph(index + 1, summary);
    summaryParagraph.setLeftToRight(true);
    applyTypographyToParagraph(summaryParagraph, typography.translationFont, typography.translationFontSize, typography.translationFontStyle);
  }

  const metaBits = [];
  if (owner) metaBits.push('Curated by ' + owner);
  if (topics.length) metaBits.push('Topics: ' + topics.slice(0, 5).join(', '));
  metaBits.push(url);
  const metaParagraph = body.insertParagraph(index + (summary ? 2 : 1), metaBits.join(' • '));
  metaParagraph.setLeftToRight(true);
  applyTypographyToParagraph(metaParagraph, typography.sefariaLinkFont, Math.max(10, typography.sefariaLinkFontSize - 1), typography.sefariaLinkFontStyle);
  metaParagraph.editAsText().setLinkUrl(url);
}


function openAiLessonGenerator() {
  const template = HtmlService.createTemplateFromFile('ai_lesson');
  template.appConfigJson = JSON.stringify(getUiAppConfig_('ai_lesson', 'experimental'));
  const output = template.evaluate()
    .setWidth(460)
    .setHeight(720);
  DocumentApp.getUi().showModalDialog(output, 'AI Lesson Generator (experimental)');
}


const AI_PROVIDER_OPTIONS_ = {
  openai: {
    label: 'ChatGPT',
    managedKeyProperties: ['OPENAI_API_KEY', 'AI_OPENAI_API_KEY'],
    defaultModel: 'gpt-5-mini',
    models: ['gpt-5', 'gpt-5-mini']
  },
  anthropic: {
    label: 'Claude',
    managedKeyProperties: ['ANTHROPIC_API_KEY', 'AI_ANTHROPIC_API_KEY'],
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022']
  },
  gemini: {
    label: 'Gemini',
    managedKeyProperties: ['GEMINI_API_KEY', 'AI_GEMINI_API_KEY'],
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro']
  }
};

function saveAiLessonDefaults_(payload) {
  const userProperties = PropertiesService.getUserProperties();
  const requestedProvider = String(payload && payload.provider || '').toLowerCase().trim();
  const provider = requestedProvider === 'default' ? 'default' : normalizeAiProvider_(requestedProvider);
  const model = provider === 'default' ? '' : sanitizeAiModel_(provider, payload && payload.model);
  userProperties.setProperty('ai_provider_default', provider);
  userProperties.setProperty('ai_model_default', model);
  userProperties.setProperty('ai_key_strategy_default', normalizeAiKeyStrategy_(payload && payload.keyStrategy));
  if (payload && payload.audience) {
    userProperties.setProperty('ai_audience_default', String(payload.audience).trim());
  }
  if (payload && payload.lessonStyle) {
    userProperties.setProperty('ai_lesson_style_default', String(payload.lessonStyle).trim());
  }
  if (payload && payload.duration) {
    userProperties.setProperty('ai_duration_default', String(Math.max(10, Math.min(120, Number(payload.duration) || 45))));
  }
  return true;
}

function clearSavedAiKey(provider) {
  const safeProvider = normalizeAiProvider_(provider);
  PropertiesService.getUserProperties().deleteProperty(getSavedAiKeyPropertyName_(safeProvider));
  return { provider: safeProvider, cleared: true };
}

function getSavedAiKeyPreview(provider) {
  const safeProvider = normalizeAiProvider_(provider);
  const value = PropertiesService.getUserProperties().getProperty(getSavedAiKeyPropertyName_(safeProvider)) || '';
  return { provider: safeProvider, masked: maskApiKey_(value) };
}

function saveAiKeyFromPreferences(provider, apiKey) {
  const safeProvider = normalizeAiProvider_(provider);
  const key = String(apiKey || '').trim();
  if (!key) throw new Error('Enter an API key before saving.');
  PropertiesService.getUserProperties().setProperty(getSavedAiKeyPropertyName_(safeProvider), key);
  return getSavedAiKeyPreview(safeProvider);
}

function maskApiKey_(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.length <= 8) return '••••••••';
  return raw.slice(0, 4) + '••••••••' + raw.slice(-4);
}

function assertExperimentalAiEnabled_() {
  const prefs = getPreferences();
  if (prefs.experimental_ai_source_sheet_enabled != 'true') {
    throw new Error('Enable the experimental AI lesson generator in Preferences before using this feature.');
  }
}

function normalizeAiProvider_(provider) {
  const safe = String(provider || '').toLowerCase().trim();
  return AI_PROVIDER_OPTIONS_[safe] ? safe : 'openai';
}

function normalizeAiKeyStrategy_(strategy) {
  const safe = String(strategy || '').toLowerCase().trim();
  return ['auto', 'managed', 'saved', 'manual'].indexOf(safe) >= 0 ? safe : 'auto';
}

function sanitizeAiModel_(provider, model) {
  const safeProvider = normalizeAiProvider_(provider);
  const providerConfig = AI_PROVIDER_OPTIONS_[safeProvider];
  const safeModel = String(model || '').trim();
  if (!safeModel) return providerConfig.defaultModel;
  if (providerConfig.models.indexOf(safeModel) >= 0) {
    return safeModel;
  }
  return providerConfig.defaultModel;
}

function hasManagedAiKey_(provider) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const config = AI_PROVIDER_OPTIONS_[normalizeAiProvider_(provider)];
  return config.managedKeyProperties.some(function(propertyName) {
    return !!scriptProperties.getProperty(propertyName);
  });
}

function hasSavedAiKey_(provider) {
  return !!PropertiesService.getUserProperties().getProperty(getSavedAiKeyPropertyName_(provider));
}

function getSavedAiKeyPropertyName_(provider) {
  return 'ai_user_key_' + normalizeAiProvider_(provider);
}

function getManagedAiCooldownSeconds_() {
  const raw = PropertiesService.getScriptProperties().getProperty('AI_MANAGED_COOLDOWN_SECONDS');
  const parsed = Number(raw || 600);
  return isNaN(parsed) || parsed < 0 ? 600 : parsed;
}

function enforceManagedAiCooldown_(provider) {
  const userProperties = PropertiesService.getUserProperties();
  const cooldownSeconds = getManagedAiCooldownSeconds_();
  const key = 'ai_managed_last_used_at_' + normalizeAiProvider_(provider);
  const lastUsed = Number(userProperties.getProperty(key) || 0);
  const now = Date.now();
  if (cooldownSeconds > 0 && lastUsed && (now - lastUsed) < cooldownSeconds * 1000) {
    const remainingSeconds = Math.ceil((cooldownSeconds * 1000 - (now - lastUsed)) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    throw new Error('Please wait about ' + remainingMinutes + ' more minute' + (remainingMinutes === 1 ? '' : 's') + ' before using the add-on managed ' + AI_PROVIDER_OPTIONS_[provider].label + ' key again.');
  }
  userProperties.setProperty(key, String(now));
}

function resolveAiCredential_(request) {
  const provider = request.provider;
  const strategy = normalizeAiKeyStrategy_(request.keyStrategy);
  const userProperties = PropertiesService.getUserProperties();
  const manualKey = String(request.apiKey || '').trim();
  const savedKey = String(userProperties.getProperty(getSavedAiKeyPropertyName_(provider)) || '').trim();
  let managedKey = '';
  const scriptProperties = PropertiesService.getScriptProperties();
  AI_PROVIDER_OPTIONS_[provider].managedKeyProperties.some(function(propertyName) {
    const candidate = String(scriptProperties.getProperty(propertyName) || '').trim();
    if (candidate) {
      managedKey = candidate;
      return true;
    }
    return false;
  });

  if (strategy === 'manual') {
    if (!manualKey) {
      throw new Error('Paste an API key for ' + AI_PROVIDER_OPTIONS_[provider].label + ' or switch to a different key source.');
    }
    return { apiKey: manualKey, source: request.saveApiKey ? 'manual-saved' : 'manual' };
  }

  if (strategy === 'saved') {
    if (!savedKey) {
      throw new Error('No saved ' + AI_PROVIDER_OPTIONS_[provider].label + ' key was found for your account.');
    }
    return { apiKey: savedKey, source: 'saved' };
  }

  if (strategy === 'managed') {
    if (!managedKey) {
      throw new Error('This add-on does not currently have a managed ' + AI_PROVIDER_OPTIONS_[provider].label + ' key configured.');
    }
    enforceManagedAiCooldown_(provider);
    return { apiKey: managedKey, source: 'managed' };
  }

  if (manualKey) {
    return { apiKey: manualKey, source: request.saveApiKey ? 'manual-saved' : 'manual' };
  }
  if (savedKey) {
    return { apiKey: savedKey, source: 'saved' };
  }
  if (managedKey) {
    enforceManagedAiCooldown_(provider);
    return { apiKey: managedKey, source: 'managed' };
  }

  throw new Error('No API key is available for ' + AI_PROVIDER_OPTIONS_[provider].label + '. Paste your own key, use a saved key, or ask an admin to configure a managed key.');
}

function persistUserAiKeyIfRequested_(request) {
  if (request.saveApiKey && String(request.apiKey || '').trim()) {
    PropertiesService.getUserProperties().setProperty(getSavedAiKeyPropertyName_(request.provider), String(request.apiKey).trim());
  }
}

function normalizeAiLessonRequest_(payload) {
  const prefs = getPreferences();
  const provider = normalizeAiProvider_(payload.provider || prefs.ai_provider_default);
  const request = {
    provider: provider,
    model: sanitizeAiModel_(provider, payload.model || prefs.ai_model_default),
    keyStrategy: normalizeAiKeyStrategy_(payload.keyStrategy || prefs.ai_key_strategy_default),
    apiKey: String(payload.apiKey || '').trim(),
    saveApiKey: payload.saveApiKey === true,
    topic: String(payload.topic || '').trim(),
    audience: String(payload.audience || 'Adult learners').trim(),
    duration: Math.max(10, Math.min(120, Number(payload.duration || 45))),
    lessonStyle: String(payload.lessonStyle || 'Interactive shiur').trim(),
    includeTransliteration: payload.includeTransliteration === true,
    additionalInstructions: String(payload.additionalInstructions || '').trim(),
    includeOriginal: payload.includeOriginal !== false,
    includeTranslation: payload.includeTranslation !== false,
    includeEducatorNotes: payload.includeEducatorNotes !== false,
    includeDiscussionPrompts: payload.includeDiscussionPrompts !== false,
    contextMode: String(payload.contextMode || 'topic').trim(),
    learningCycleContext: payload.learningCycleContext || null
  };

  if (request.contextMode !== 'learning_cycle' && !request.topic) {
    throw new Error('Add a topic before generating a lesson draft.');
  }
  return request;
}

function pickAvailableAiProvider_() {
  const preferred = normalizeAiProvider_(PropertiesService.getUserProperties().getProperty('ai_provider_default'));
  const ordered = [preferred].concat(Object.keys(AI_PROVIDER_OPTIONS_).filter(function(provider) {
    return provider !== preferred;
  }));
  for (let i = 0; i < ordered.length; i++) {
    if (hasSavedAiKey_(ordered[i]) || hasManagedAiKey_(ordered[i])) {
      return ordered[i];
    }
  }
  return '';
}

function buildTodaysLearningCycleContext_() {
  const response = UrlFetchApp.fetch('https://www.sefaria.org/api/calendars', { muteHttpExceptions: true });
  const status = response.getResponseCode ? response.getResponseCode() : 200;
  if (status >= 400) {
    throw new Error('Could not retrieve today’s learning cycle from Sefaria right now.');
  }

  const raw = JSON.parse(response.getContentText() || '[]');
  const items = Array.isArray(raw) ? raw : (raw.calendar_items || raw.items || []);
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Sefaria returned an empty learning cycle feed.');
  }

  const daf = pickCalendarItem_(items, ['daf yomi']);
  const chapter929 = pickCalendarItem_(items, ['929']);
  const parashah = pickCalendarItem_(items, ['parash', 'hashavua']);

  const contexts = [daf, chapter929, parashah].filter(Boolean);
  if (!contexts.length) {
    throw new Error('Could not identify Daf Yomi, 929, or Parashah in today’s Sefaria calendar feed.');
  }

  return {
    topicLine: contexts.map(function(item) { return item.label + ': ' + item.ref; }).join(' | '),
    summary: contexts.map(function(item) { return item.label + ' — ' + item.ref; }).join('\n'),
    items: contexts
  };
}

function pickCalendarItem_(items, patterns) {
  const tests = (patterns || []).map(function(value) {
    return String(value || '').toLowerCase();
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i] || {};
    const haystack = [
      item.title && item.title.en,
      item.title && item.title.he,
      item.displayValue && item.displayValue.en,
      item.displayValue && item.displayValue.he,
      item.category,
      item.en,
      item.he,
      item.name
    ].filter(Boolean).join(' | ').toLowerCase();

    const matched = tests.some(function(testValue) {
      return haystack.indexOf(testValue) >= 0;
    });
    if (!matched) {
      continue;
    }

    const ref = String(item.ref || item.displayValue && item.displayValue.en || item.en || '').trim();
    if (!ref) {
      continue;
    }

    const label = String(item.title && item.title.en || item.name || item.category || 'Learning Cycle').trim();
    return {
      label: label,
      ref: ref
    };
  }

  return null;
}

function generateLessonDraftViaProvider_(request, keyInfo) {
  const prompt = buildLessonGenerationPrompt_(request);
  switch (request.provider) {
    case 'anthropic':
      return parseAiLessonJson_(callAnthropicForLesson_(request.model, keyInfo.apiKey, prompt));
    case 'gemini':
      return parseAiLessonJson_(callGeminiForLesson_(request.model, keyInfo.apiKey, prompt));
    case 'openai':
    default:
      return parseAiLessonJson_(callOpenAiForLesson_(request.model, keyInfo.apiKey, prompt));
  }
}

function buildLessonGenerationPrompt_(request) {
  const sourceInstructions = request.contextMode === 'learning_cycle'
    ? 'Prioritize the supplied learning-cycle references as the backbone of the lesson. You may add at most two supplementary classic references if they genuinely improve the teaching flow.'
    : 'Suggest 4 to 6 references that are likely to be accessible on Sefaria and relevant for a Jewish source-sheet or shiur format.';

  const contextBlock = request.contextMode === 'learning_cycle' && request.learningCycleContext
    ? 'Learning-cycle context:\n' + request.learningCycleContext.items.map(function(item) {
        return '- ' + item.label + ': ' + item.ref;
      }).join('\n')
    : 'Topic: ' + request.topic;

  return [
    'You are generating a structured Jewish lesson draft for insertion into Google Docs.',
    'Write practical, modest, editable teaching content. Do not use markdown fences.',
    'Return valid JSON only, with no commentary before or after it.',
    'Schema:',
    '{',
    '  "lessonTitle": string,',
    '  "framingQuestion": string,',
    '  "overview": string,',
    '  "learningGoals": [string],',
    '  "teachingFlow": [string],',
    '  "sources": [',
    '    {',
    '      "citation": string,',
    '      "whyItMatters": string,',
    '      "discussionPrompt": string',
    '    }',
    '  ]',
    '}',
    '',
    contextBlock,
    'Audience: ' + request.audience,
    'Duration minutes: ' + request.duration,
    'Lesson style: ' + request.lessonStyle,
    'Additional instructions: ' + (request.additionalInstructions || 'None provided.'),
    request.contextMode === 'text_ref' ? 'Treat the supplied topic line as the primary text or reference to anchor the lesson.' : '',
    sourceInstructions,
    'Keep the source list short enough to fit a real ' + request.duration + '-minute session.',
    'Review before sharing. Avoid grandiose claims.'
  ].join('\n');
}

function callOpenAiForLesson_(model, apiKey, prompt) {
  const payload = {
    model: model,
    input: prompt
  };
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return extractOpenAiTextResponse_(response);
}

function extractOpenAiTextResponse_(response) {
  const status = response.getResponseCode ? response.getResponseCode() : 200;
  const body = JSON.parse(response.getContentText() || '{}');
  if (status >= 400) {
    throw new Error(formatOpenAiError_(status, body));
  }
  if (body.output_text) {
    return body.output_text;
  }
  const outputs = Array.isArray(body.output) ? body.output : [];
  for (let i = 0; i < outputs.length; i++) {
    const content = Array.isArray(outputs[i].content) ? outputs[i].content : [];
    for (let j = 0; j < content.length; j++) {
      if (content[j] && typeof content[j].text === 'string') {
        return content[j].text;
      }
    }
  }
  throw new Error('OpenAI returned an empty response.');
}

function formatOpenAiError_(status, body) {
  const message = body && body.error && body.error.message ? body.error.message : 'OpenAI request failed.';
  if (status === 401) return 'OpenAI rejected the API key. Check the key and try again.';
  if (status === 429) return 'OpenAI rate-limited this request. Please wait a moment and try again.';
  return 'OpenAI error (' + status + '): ' + message;
}

function callAnthropicForLesson_(model, apiKey, prompt) {
  const payload = {
    model: model,
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }]
  };
  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return extractAnthropicTextResponse_(response);
}

function extractAnthropicTextResponse_(response) {
  const status = response.getResponseCode ? response.getResponseCode() : 200;
  const body = JSON.parse(response.getContentText() || '{}');
  if (status >= 400) {
    throw new Error(formatAnthropicError_(status, body));
  }
  const content = Array.isArray(body.content) ? body.content : [];
  const textParts = content.filter(function(part) {
    return part && part.type === 'text' && typeof part.text === 'string';
  }).map(function(part) { return part.text; });
  if (textParts.length) {
    return textParts.join('\n');
  }
  throw new Error('Anthropic returned an empty response.');
}

function formatAnthropicError_(status, body) {
  const errorObj = body && body.error ? body.error : {};
  const message = errorObj.message || 'Anthropic request failed.';
  if (status === 401) return 'Anthropic rejected the API key. Check the key and try again.';
  if (status === 429) return 'Anthropic rate-limited this request. Please wait a moment and try again.';
  return 'Anthropic error (' + status + '): ' + message;
}

function callGeminiForLesson_(model, apiKey, prompt) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return extractGeminiTextResponse_(response);
}

function extractGeminiTextResponse_(response) {
  const status = response.getResponseCode ? response.getResponseCode() : 200;
  const body = JSON.parse(response.getContentText() || '{}');
  if (status >= 400) {
    throw new Error(formatGeminiError_(status, body));
  }
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  for (let i = 0; i < candidates.length; i++) {
    const content = candidates[i] && candidates[i].content;
    const parts = content && Array.isArray(content.parts) ? content.parts : [];
    for (let j = 0; j < parts.length; j++) {
      if (parts[j] && typeof parts[j].text === 'string') {
        return parts[j].text;
      }
    }
  }
  throw new Error('Gemini returned an empty response.');
}

function formatGeminiError_(status, body) {
  const errorObj = body && body.error ? body.error : {};
  const message = errorObj.message || 'Gemini request failed.';
  if (status === 400) return 'Gemini rejected the request. ' + message;
  if (status === 401 || status === 403) return 'Gemini rejected the API key. Check the key and try again.';
  if (status === 429) return 'Gemini rate-limited this request. Please wait a moment and try again.';
  return 'Gemini error (' + status + '): ' + message;
}

function parseAiLessonJson_(rawText) {
  const safeText = String(rawText || '').trim();
  const candidates = [];
  candidates.push(safeText);
  const fenced = safeText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    candidates.push(fenced[1].trim());
  }
  const firstBrace = safeText.indexOf('{');
  const lastBrace = safeText.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(safeText.slice(firstBrace, lastBrace + 1));
  }

  let parsed = null;
  for (let i = 0; i < candidates.length; i++) {
    try {
      parsed = JSON.parse(candidates[i]);
      break;
    } catch (error) {}
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('The AI provider returned an unreadable draft. Please try again or switch providers.');
  }

  return {
    lessonTitle: String(parsed.lessonTitle || parsed.title || 'Untitled Lesson Draft').trim(),
    framingQuestion: String(parsed.framingQuestion || parsed.essentialQuestion || '').trim(),
    overview: String(parsed.overview || '').trim(),
    learningGoals: Array.isArray(parsed.learningGoals) ? parsed.learningGoals.map(function(item) { return String(item || '').trim(); }).filter(Boolean) : [],
    teachingFlow: Array.isArray(parsed.teachingFlow) ? parsed.teachingFlow.map(function(item) { return String(item || '').trim(); }).filter(Boolean) : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources.map(function(item) {
      return {
        citation: String(item && (item.citation || item.ref) || '').trim(),
        whyItMatters: String(item && (item.whyItMatters || item.note) || '').trim(),
        discussionPrompt: String(item && (item.discussionPrompt || item.prompt) || '').trim()
      };
    }).filter(function(item) { return item.citation; }) : [],
    warnings: []
  };
}

function enrichLessonWithSefariaTexts_(lesson, request) {
  const enriched = JSON.parse(JSON.stringify(lesson || {}));
  const warnings = Array.isArray(enriched.warnings) ? enriched.warnings.slice() : [];
  enriched.sources = (enriched.sources || []).slice(0, 8).map(function(source) {
    const entry = JSON.parse(JSON.stringify(source));
    try {
      const resolved = findReference(entry.citation, undefined, false);
      if (resolved && resolved.ref) {
        entry.citation = resolved.ref;
        entry.hebrewCitation = resolved.heRef || '';
        if (request.includeOriginal) {
          entry.originalText = summarizeSefariaTextForLesson_(resolved.he);
        }
        if (request.includeTranslation) {
          entry.translationText = summarizeSefariaTextForLesson_(resolved.text);
        }
      } else {
        warnings.push('Could not resolve source: ' + entry.citation);
      }
    } catch (error) {
      warnings.push('Could not resolve source: ' + entry.citation);
    }
    return entry;
  });
  enriched.warnings = warnings;
  return enriched;
}

function summarizeSefariaTextForLesson_(value) {
  const flattened = flattenSefariaText_(value).trim();
  if (!flattened) {
    return '';
  }
  if (flattened.length > 1200) {
    return flattened.slice(0, 1197) + '...';
  }
  return flattened;
}

function flattenSefariaText_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return flattenSefariaText_(item); }).filter(Boolean).join('\n');
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/<[^>]+>/g, '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function insertGeneratedLessonIntoDoc_(lesson, request) {
  const document = DocumentApp.getActiveDocument();
  if (!document) {
    throw new Error('Open a Google Doc before generating a lesson draft.');
  }

  const body = document.getBody();
  const typography = getTypographySettings();
  let index = body.getNumChildren();
  const cursor = document.getCursor();
  if (cursor) {
    const currentElement = cursor.getElement();
    if (currentElement && currentElement.getParent()) {
      index = currentElement.getParent().getChildIndex(currentElement) + 1;
    }
  }

  const insertParagraph_ = function(text, heading, font, size, style, rtl) {
    const paragraph = body.insertParagraph(index++, text);
    if (heading) {
      paragraph.setHeading(heading);
    }
    if (heading === DocumentApp.ParagraphHeading.HEADING1) {
      applyTitleTypography(paragraph, typography, false);
    } else if (heading === DocumentApp.ParagraphHeading.HEADING2) {
      applyTitleTypography(paragraph, typography, true);
    } else {
      paragraph.setLeftToRight(rtl ? false : true);
      applyTypographyToParagraph(paragraph, font || typography.translationFont, size || typography.translationFontSize, style || typography.translationFontStyle);
    }
    return paragraph;
  };

  insertParagraph_(lesson.lessonTitle || 'Lesson Draft', DocumentApp.ParagraphHeading.HEADING1);

  if (lesson.framingQuestion) {
    insertParagraph_('Framing Question: ' + lesson.framingQuestion, null);
  }
  if (lesson.overview) {
    insertParagraph_(lesson.overview, null);
  }
  if (Array.isArray(lesson.learningGoals) && lesson.learningGoals.length) {
    insertParagraph_('Learning Goals', DocumentApp.ParagraphHeading.HEADING3, typography.sourceTitleFont, typography.sourceTitleFontSize, typography.sourceTitleFontStyle);
    lesson.learningGoals.forEach(function(item) {
      const bullet = body.insertListItem(index++, item);
      applyTypographyToParagraph(bullet, typography.translationFont, typography.translationFontSize, typography.translationFontStyle);
    });
  }
  if (Array.isArray(lesson.teachingFlow) && lesson.teachingFlow.length) {
    insertParagraph_('Teaching Flow', DocumentApp.ParagraphHeading.HEADING3, typography.sourceTitleFont, typography.sourceTitleFontSize, typography.sourceTitleFontStyle);
    lesson.teachingFlow.forEach(function(item) {
      const bullet = body.insertListItem(index++, item);
      applyTypographyToParagraph(bullet, typography.translationFont, typography.translationFontSize, typography.translationFontStyle);
    });
  }

  insertParagraph_('Experimental draft — review, fact-check, and edit before sharing.', null);

  (lesson.sources || []).forEach(function(source) {
    insertParagraph_(source.citation || 'Source', DocumentApp.ParagraphHeading.HEADING2);

    if (request.includeOriginal && source.originalText) {
      insertParagraph_('Hebrew / Original: ' + source.originalText, null, typography.hebrewFont, typography.hebrewFontSize, typography.hebrewFontStyle, true);
    }
    if (request.includeTranslation && source.translationText) {
      insertParagraph_('Translation: ' + source.translationText, null, typography.translationFont, typography.translationFontSize, typography.translationFontStyle, false);
    }
    if (request.includeEducatorNotes && source.whyItMatters) {
      insertParagraph_('Educator Note: ' + source.whyItMatters, null);
    }
    if (request.includeDiscussionPrompts && source.discussionPrompt) {
      insertParagraph_('Discussion Prompt: ' + source.discussionPrompt, null);
    }
  });

  return {
    insertedAt: new Date().toISOString()
  };
}


function preferencesPopup() {
  const template = HtmlService.createTemplateFromFile('preferences');
  template.appConfigJson = JSON.stringify(getUiAppConfig_('preferences', 'preferences'));
  const output = template.evaluate()
    .setTitle('Preferences')
    .setWidth(600)
    .setHeight(760);
  DocumentApp.getUi().showModalDialog(output, 'Preferences');
}

function divineNamePopup() {
  transformDivineNames();
}

function linkerHTML() {
  linkTextsWithSefaria();
}
