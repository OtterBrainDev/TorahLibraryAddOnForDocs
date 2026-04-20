import fs from 'fs';

const pageExpectations = {
  'sidebar.html': [
    "include('ui_head')",
    'window.APP_CONFIG',
    "include('ui_core.js')",
    "include('ui_api.js')",
    "include('ui_state.js')",
    "include('ui_dom.js')",
    "include('ui_feedback.js')"
  ],
  'preferences.html': [
    "include('ui_head')",
    'window.APP_CONFIG',
    "include('ui_core.js')",
    "include('ui_api.js')",
    "include('ui_state.js')",
    "include('ui_dom.js')",
    "include('ui_feedback.js')"
  ],
  'ai_lesson.html': [
    "include('ui_head')",
    'window.APP_CONFIG',
    "include('ui_core.js')",
    "include('ui_api.js')",
    "include('ui_state.js')",
    "include('ui_dom.js')",
    "include('ui_feedback.js')"
  ],
  'surprise-me.html': [
    "include('ui_head')",
    'window.APP_CONFIG',
    "include('ui_core.js')",
    "include('ui_api.js')",
    "include('ui_state.js')",
    "include('ui_dom.js')",
    "include('ui_feedback.js')"
  ]
};

let failed = false;

for (const [file, expectedSnippets] of Object.entries(pageExpectations)) {
  if (!fs.existsSync(file)) {
    console.warn(`[SKIP] ${file} not found`);
    continue;
  }
  const content = fs.readFileSync(file, 'utf8');
  for (const snippet of expectedSnippets) {
    if (!content.includes(snippet)) {
      console.error(`[FAIL] ${file} missing snippet: ${snippet}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log('[PASS] HTML include wiring looks correct.');
