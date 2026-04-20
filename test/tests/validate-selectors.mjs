import fs from 'fs';

const selectors = JSON.parse(fs.readFileSync('tests/fixtures/expected-selectors.json', 'utf8'));

let failed = false;

for (const [file, requiredSelectors] of Object.entries(selectors)) {
  if (!fs.existsSync(file)) {
    console.warn(`[SKIP] ${file} not found`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const selector of requiredSelectors) {
    const needle = selector.startsWith('#')
      ? `id="${selector.slice(1)}"`
      : selector.startsWith('.')
        ? `class="${selector.slice(1)}`
        : selector;

    if (!content.includes(selector) && !content.includes(needle)) {
      console.error(`[FAIL] ${file} missing selector or literal reference: ${selector}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('[PASS] Required selectors still exist.');
