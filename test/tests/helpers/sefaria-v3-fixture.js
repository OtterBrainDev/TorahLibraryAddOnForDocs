// Synthetic text samples used by display/filter and linker tests. Put their
// small sample strings into the v3 wire shape; no top-level v1 text/he or
// selected-edition fields are sent to the production normalizer. Authentic
// API fixtures and the full normalization contract are tested separately.
function v3TextFixture(sample) {
  const {
    text, he, type, versions: _legacyCatalog,
    versionTitle = 'Fixture translation', heVersionTitle = 'Fixture source',
    versionSource = '', heVersionSource = '', license = '', heLicense = '',
    actualLanguage = 'en', ...metadata
  } = sample;
  const versions = [];
  if (Object.prototype.hasOwnProperty.call(sample, 'he')) {
    versions.push({
      versionTitle: heVersionTitle, versionSource: heVersionSource, license: heLicense,
      language: 'he', actualLanguage: 'he', languageFamilyName: 'hebrew',
      direction: 'rtl', isPrimary: true, isSource: true, text: he
    });
  }
  if (Object.prototype.hasOwnProperty.call(sample, 'text')) {
    versions.push({
      versionTitle: versionTitle, versionSource: versionSource, license: license,
      language: 'en', actualLanguage: actualLanguage, languageFamilyName: 'english',
      direction: 'ltr', isPrimary: false, isSource: false, text: text
    });
  }
  return Object.assign({
    indexTitle: v3RefFixture(sample).index_title,
    primary_category: type || sample.primary_category || 'Tanakh',
    categories: [type || sample.primary_category || 'Tanakh'],
    warnings: [],
  }, metadata, {
    versions: versions,
    available_versions: versions.map(({ text: _text, ...version }) => version)
  });
}

// Ref metadata uses its own documented field names. Display/filter fixtures
// address one known passage; the migration suite covers broad/complex refs.
function v3RefFixture(sample) {
  const ref = sample.ref;
  const address = /\s+([^\s,]+:[^\s,]+|\d+[ab]?)$/.exec(ref);
  const labels = address ? address[1].split('-')[0].split(':') : [];
  return {
    is_ref: true,
    normalized: ref,
    hebrew: sample.heRef || '',
    index_title: sample.indexTitle || (address ? ref.slice(0, address.index) : ref),
    node_type: 'JaggedArrayNode',
    depth: 2,
    address_types: ['Perek', 'Pasuk'],
    section_names: ['Chapter', 'Verse'],
    start_labels: labels,
    end_labels: labels,
    navigation_refs: { first_available_section_ref: labels.length ? ref : ref + ' 1' }
  };
}

function v3FixtureFetch(sample) {
  return function (url) {
    let payload;
    if (/\/api\/ref\//.test(url)) payload = v3RefFixture(sample);
    else if (/\/api\/v3\/texts\//.test(url)) payload = v3TextFixture(sample);
    else throw new Error('Unexpected fixture API route');
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify(payload) };
  };
}

module.exports = { v3TextFixture, v3RefFixture, v3FixtureFetch };
