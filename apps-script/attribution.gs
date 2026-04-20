/*
Pure attribution helper that works in both Google Apps Script and Node.
*/
(function (globalScope) {
  function findSelectedEnglishVersion(data) {
    if (!data || !Array.isArray(data.versions)) {
      return null;
    }

    if (data.versionTitle) {
      const byTitle = data.versions.find(
        (version) => version.language === "en" && version.versionTitle === data.versionTitle
      );
      if (byTitle) {
        return byTitle;
      }
    }

    return data.versions.find((version) => version.language === "en") || null;
  }

  function cleanSourceForDisplay(source) {
    if (!source) {
      return "";
    }

    try {
      const parsed = new URL(source);
      return parsed.hostname.replace(/^www\./, "");
    } catch (_error) {
      return source;
    }
  }

  function getEnglishAttributionDetails(data) {
    const selectedVersion = findSelectedEnglishVersion(data);
    const versionTitle = (data && data.versionTitle) || (selectedVersion && selectedVersion.versionTitle);

    if (!versionTitle) {
      return null;
    }

    const source =
      (data && data.versionSource) ||
      (selectedVersion && selectedVersion.versionSource) ||
      "";

    const digitization =
      (data && data.versionDigitizedBy) ||
      (data && data.digitizedBy) ||
      (selectedVersion && (selectedVersion.versionDigitizedBy || selectedVersion.digitizedBy)) ||
      "";

    const license =
      (data && (data.versionLicense || data.license)) ||
      (selectedVersion && (selectedVersion.versionLicense || selectedVersion.license)) ||
      "";

    return {
      versionTitle,
      source,
      sourceDisplay: cleanSourceForDisplay(source),
      digitization,
      license,
    };
  }

  function getEnglishAttributionLines(data) {
    const details = getEnglishAttributionDetails(data);
    if (!details) {
      return [];
    }

    const lines = [details.versionTitle];
    if (details.sourceDisplay) {
      lines.push(`Source: ${details.sourceDisplay}`);
    }
    if (details.digitization) {
      lines.push(`Digitization: ${details.digitization}`);
    }
    if (details.license) {
      lines.push(`License: ${details.license}`);
    }

    return lines;
  }

  function getEnglishAttribution(data) {
    return getEnglishAttributionLines(data).join("\n");
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      getEnglishAttributionDetails,
      getEnglishAttributionLines,
      getEnglishAttribution,
    };
  }

  globalScope.getEnglishAttributionDetails = getEnglishAttributionDetails;
  globalScope.getEnglishAttributionLines = getEnglishAttributionLines;
  globalScope.getEnglishAttribution = getEnglishAttribution;
})(typeof globalThis !== "undefined" ? globalThis : this);
