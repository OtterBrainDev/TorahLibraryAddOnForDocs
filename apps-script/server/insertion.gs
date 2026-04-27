// Insertion module: inserting resolved references into Google Docs.
// Handles layout modes (bilingual, single-language), typography application,
// transliteration rendering, and rich-text HTML-to-Docs conversion.
// All functions called from menu.gs or client-side insertReference handlers.

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

/**
 * Insert a resolved Sefaria source into the active Google Doc.
 *
 * Signature is an options bag so callers don't have to remember the order of
 * nine positional booleans. The internal body still uses the same local
 * variable names that the pre-refactor positional signature used, which is
 * why the destructure is so explicit — it keeps the 350-line body stable
 * while fixing the ergonomics at the call site.
 *
 * @param {Object} data          Resolved Sefaria payload (required).
 * @param {Object} [opts]        Per-call display/layout overrides.
 * @param {string} [opts.singleLanguage]                "he" | "en" | undefined (bilingual).
 * @param {boolean|string} [opts.pasukPreference=true]  Include line markers.
 * @param {string|null} [opts.preferredTitle]           Override the title shown (e.g. "Bereishit").
 * @param {boolean} [opts.includeTranslationSourceInfo] Append translation attribution.
 * @param {string} [opts.bilingualLayout="he-right"]    Bilingual layout mode.
 * @param {boolean} [opts.insertSefariaLink]            Hyperlink the title to sefaria.org.
 * @param {boolean} [opts.includeTransliteration]       Include transliteration of the Hebrew.
 * @param {boolean} [opts.insertCitationOnly]           Insert just the citation title, no body.
 */
function insertReference(data, opts) {
  const options = opts || {};
  const singleLanguage = options.singleLanguage;
  const pasukPreference = options.pasukPreference !== undefined ? options.pasukPreference : true;
  const preferredTitle = options.preferredTitle !== undefined ? options.preferredTitle : null;
  const includeTranslationSourceInfo = options.includeTranslationSourceInfo === true;
  const bilingualLayout = options.bilingualLayout || "he-right";
  const insertSefariaLink = options.insertSefariaLink === true;
  const includeTransliteration = options.includeTransliteration === true;
  const insertCitationOnly = options.insertCitationOnly === true;

  if (!data || !data.ref) {
    throw new Error("Unable to insert source: no resolved reference.");
  }

  let title = (preferredTitle) ? preferredTitle : data.ref;
  const includeLineMarkers = pasukPreference === true || pasukPreference === 'true';
  data = formatDataForPesukim(data, includeLineMarkers);

  let doc = DocumentApp.getActiveDocument().getBody();
  let docWrapper = DocumentApp.getActiveDocument();
  let cursor = docWrapper.getCursor();
  let selection = docWrapper.getSelection();
  let index = doc.getNumChildren();

  const resolveSafeSelectionInsertionIndex = () => {
    if (!selection) return null;

    let rangeElements = selection.getRangeElements();
    if (!rangeElements || rangeElements.length === 0) return null;

    let firstElement = rangeElements[0].getElement();
    let bodyLevelElement = firstElement;
    while (bodyLevelElement.getParent && bodyLevelElement.getParent() && bodyLevelElement.getParent() !== doc) {
      bodyLevelElement = bodyLevelElement.getParent();
    }

    if (!bodyLevelElement || bodyLevelElement.getParent() !== doc) {
      throw new Error("Your selection is inside a table, header, or footer, which isn't supported. Click to place your cursor in the main body of the document, then try again.");
    }

    let insertionIndex = doc.getChildIndex(bodyLevelElement) + 1;

    for (let i = rangeElements.length - 1; i >= 0; i--) {
      let re = rangeElements[i];
      let el = re.getElement();
      try {
        if (re.isPartial()) {
          if (el.getType() === DocumentApp.ElementType.TEXT) {
            let start = re.getStartOffset();
            let end = re.getEndOffsetInclusive();
            if (start >= 0 && end >= start) {
              el.asText().deleteText(start, end);
            }
          }
        } else {
          let type = el.getType();
          if (type === DocumentApp.ElementType.TEXT) {
            let text = el.asText().getText();
            if (text.length > 0) {
              el.asText().deleteText(0, text.length - 1);
            }
          } else if (type === DocumentApp.ElementType.PARAGRAPH || type === DocumentApp.ElementType.LIST_ITEM) {
            if (el.getParent() === doc && doc.getNumChildren() > 1) {
              let elIndex = doc.getChildIndex(el);
              el.removeFromParent();
              if (elIndex < insertionIndex) {
                insertionIndex--;
              }
            } else {
              try { el.clear(); } catch (e) {}
            }
          }
        }
      } catch (e) {
        // Skip any element that cannot be deleted
      }
    }

    return insertionIndex;
  };

  if (!cursor && selection) {
    index = resolveSafeSelectionInsertionIndex();
  }

  if (cursor) {
    let currentElement = cursor.getElement();
    if (currentElement) {
      let paragraphParent = currentElement.getParent();
      if (paragraphParent) {
        index = paragraphParent.getChildIndex(currentElement) + 1;
      }
    }
  }
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

      for (let r = 0; r < table.getNumRows(); r++) {
        const row = table.getRow(r);
        for (let c = 0; c < row.getNumCells(); c++) {
          const cell = row.getCell(c);
          const n = cell.getNumChildren();
          cell.getChild(n - 1).removeFromParent();
        }
      }

      if (transliterationText) {
        insertTransliterationIntoCell(table.getCell(1, hebrewColumn), transliterationText, typography);
      }
    }
  }
}

// Converts HTML from Sefaria API to rich-text in Google Docs.
// Handles <b>, <i>, <br>, <sup> (footnotes) tags and escapes HTML entities.
function insertRichTextFromHTML(element, htmlString) {
  const extendedGemaraPreference =
    PropertiesService.getUserProperties().getProperty("extended_gemara") === "true";

  element = element.editAsText();
  let buf = [];
  let index = 0, italicsFnCount = 0, textLength = element.editAsText().getText().length;
  let bolded = false, italicized = false, inFootnote = false;

  if (Array.isArray(htmlString)) {
    htmlString = htmlString.join("");
  }
  let iterableString = htmlString.split(/(<\/?[a-zA-Z]+[a-zA-Z'"0-9= \-/]*>)/g);

  let inserterFn = (textModification) => {
    let snippet = buf.join("");
    snippet = decodeHTMLEntities(snippet);

    let snippetLength = snippet.length;
    let snippetIndex = snippetLength - 1;

    if (snippet != "") {
      element.insertText(textLength, snippet);

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

  let snippet = buf.join("");
  if ( snippet != "" ) {
    snippet = decodeHTMLEntities(snippet);
    element.insertText(textLength, snippet);
    let snippetIndex = snippet.length - 1;
    element.setBold(textLength, textLength+snippetIndex, false);
    element.setItalic(textLength, textLength+snippetIndex, false);
  }
}
