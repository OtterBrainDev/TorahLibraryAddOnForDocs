import fs from 'fs';
import path from 'path';

const files = ['sidebar.html', 'preferences.html', 'ai_lesson.html', 'surprise-me.html'];
const snapshotDir = 'tests/snapshots';

function normalize(content) {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, '<script>__SCRIPT__</script>')
    .replace(/<style[\s\S]*?<\/style>/gi, '<style>__STYLE__</style>')
    .replace(/\s+/g, ' ')
    .trim();
}

if (!fs.existsSync(snapshotDir)) {
  fs.mkdirSync(snapshotDir, { recursive: true });
}

let failed = false;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.warn(`[SKIP] ${file} not found`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  const normalized = normalize(content);

  const snapshotFile = path.join(snapshotDir, `${file}.snapshot.txt`);

  if (!fs.existsSync(snapshotFile)) {
    fs.writeFileSync(snapshotFile, normalized);
    console.log(`[SNAPSHOT CREATED] ${snapshotFile}`);
    continue;
  }

  const baseline = fs.readFileSync(snapshotFile, 'utf8');
  if (baseline !== normalized) {
    console.error(`[FAIL] Snapshot changed: ${file}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('[PASS] Template snapshots unchanged.');
