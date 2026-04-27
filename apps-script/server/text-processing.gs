// Pure text transformations applied before insertion: Hebrew display
// filtering (niqqud / teamim), divine-name replacement, line-marker
// formatting. Every function here should be deterministic and testable
// without DocumentApp.

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

/**
 * Config-driven union of the Hebrew and English divine-name replacement passes.
 * One gate (`apply_sheimot_on_insertion`) covers both. Each rule names the
 * preference that enables it, the preference (or literal) that holds the
 * substitute, the regex pattern, and the data fields it should sweep over.
 * Returns a cloned `data` with all enabled replacements applied. Callers that
 * only want one language can pass `{ hebrew: true, english: false }` (or vice
 * versa) in `options`; default is both.
 */
function applyDivineNameReplacements(data, userProperties, options) {
  if (!data || typeof data !== 'object') return data;
  if (userProperties.getProperty("apply_sheimot_on_insertion") != "true") return data;

  const includeHebrew = !options || options.hebrew !== false;
  const includeEnglish = !options || options.english !== false;

  const allRules = [];
  if (includeHebrew) {
    allRules.push({ enabledBy: "meforash_replace", pattern: /י[֑-ׇ]*ה[֑-ׇ]*ו[֑-ׇ]*ה[֑-ׇ]*/g, replacementKey: "meforash_replacement", requireReplacement: true, fields: ["he", "heRef"] });
    allRules.push({ enabledBy: "yaw_replace",      pattern: /י[֑-ׇ]*ה[֑-ׇ]*/g,                    replacementKey: "yaw_replacement",      requireReplacement: false, fields: ["he", "heRef"] });
    allRules.push({ enabledBy: "elodim_replace",   pattern: /א[֑-ׇ]*ל[֑-ׇ]*ו[֑-ׇ]*ה[֑-ׇ]*י[֑-ׇ]*ם[֑-ׇ]*/g, replacementKey: "elodim_replacement",   requireReplacement: false, fields: ["he", "heRef"] });
  }
  if (includeEnglish) {
    allRules.push({ enabledBy: "god_replace", pattern: /\bGod\b/g, replacementKey: "god_replacement", defaultReplacement: "G-d", requireReplacement: false, fields: ["text"] });
  }

  const activeRules = [];
  for (const rule of allRules) {
    if (userProperties.getProperty(rule.enabledBy) != "true") continue;
    const replacement = userProperties.getProperty(rule.replacementKey);
    if (rule.requireReplacement && !replacement) continue;
    activeRules.push({
      pattern: rule.pattern,
      replacement: replacement || rule.defaultReplacement || "",
      fields: rule.fields,
    });
  }
  if (!activeRules.length) return data;

  const sweep = (node, rules) => {
    if (Array.isArray(node)) return node.map((value) => sweep(value, rules));
    if (typeof node === 'string') {
      return rules.reduce((current, rule) => current.replace(rule.pattern, rule.replacement), node);
    }
    return node;
  };

  const rulesByField = {};
  for (const rule of activeRules) {
    for (const field of rule.fields) {
      (rulesByField[field] = rulesByField[field] || []).push(rule);
    }
  }

  const clone = JSON.parse(JSON.stringify(data));
  for (const field of Object.keys(rulesByField)) {
    if (Object.prototype.hasOwnProperty.call(clone, field)) {
      clone[field] = sweep(clone[field], rulesByField[field]);
    }
  }
  return clone;
}

/**
 * Legacy Hebrew-only wrapper. Retained for the Node unit tests; new server
 * code should call `applyDivineNameReplacements` directly.
 */
function applyHebrewDivineNamePreferences(data, userProperties) {
  return applyDivineNameReplacements(data, userProperties, { hebrew: true, english: false });
}

/**
 * Legacy English-only wrapper. Mutates `data.text` in place to preserve the
 * pre-refactor call-site contract (`apply...(data, userProperties)` with no
 * return-value usage).
 */
function applyEnglishDivineNamePreference(data, userProperties) {
  if (!data) return;
  const replaced = applyDivineNameReplacements(data, userProperties, { hebrew: false, english: true });
  if (replaced !== data && Object.prototype.hasOwnProperty.call(replaced, 'text')) {
    data.text = replaced.text;
  }
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
    // When line markers are on, each verse gets a numbered header and its own
    // line (newline separator). When line markers are off, verses run together
    // as prose with a single space between them — matching the original
    // non-pesukim behavior before the rewrite appended `\n` unconditionally.
    // See docs/regression-log.md.
    if (pesukim) {
      return wrapper + "(" + gematriya(number, { punctuate: false }) + ") " + text + "\n";
    }
    return wrapper + (wrapper ? " " : "") + text;
  }
  function addEnglishVerse(text, wrapper, pesukim, number) {
    if (pesukim) {
      return wrapper + "(" + number + ") " + text + "\n";
    }
    return wrapper + (wrapper ? " " : "") + text;
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
}
