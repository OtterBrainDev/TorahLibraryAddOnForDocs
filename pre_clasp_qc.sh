#!/usr/bin/env bash
set -uo pipefail

ROOT="${1:-.}"
TMP="${TMPDIR:-/tmp}/addon_qc_$$"
mkdir -p "$TMP"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
blue()   { printf '\033[36m%s\033[0m\n' "$*"; }

FAIL=0
WARN=0

note_fail() { red "FAIL: $*"; FAIL=$((FAIL+1)); }
note_warn() { yellow "WARN: $*"; WARN=$((WARN+1)); }
note_ok()   { green "OK: $*"; }

cd "$ROOT" || { echo "Could not cd to $ROOT"; exit 2; }

blue "== Pre-clasp QC =="

# Collect files
mapfile -t ALL_FILES < <(find . -maxdepth 1 -type f \( -name '*.gs' -o -name '*.html' -o -name '*.js' -o -name '*.css' \) | sort)
mapfile -t HTML_FILES < <(find . -maxdepth 1 -type f -name '*.html' | sort)

if [ "${#ALL_FILES[@]}" -eq 0 ]; then
  note_fail "No .gs/.html/.js/.css files found in project root."
  exit 1
fi

blue "-- 1) Basename collision check --"
dups=$(
  printf '%s\n' "${ALL_FILES[@]}" \
  | sed 's#.*/##' \
  | sed 's/\.[^.]*$//' \
  | sort \
  | uniq -d
)
if [ -n "$dups" ]; then
  note_fail "Duplicate basenames found:"
  printf '%s\n' "$dups" | sed 's/^/  - /'
else
  note_ok "No duplicate basenames."
fi

blue "-- 2) Style/script tag balance in HTML files --"
for f in "${HTML_FILES[@]}"; do
  style_open=$(grep -o '<style[^>]*>' "$f" | wc -l | tr -d ' ')
  style_close=$(grep -o '</style>' "$f" | wc -l | tr -d ' ')
  script_open=$(grep -o '<script[^>]*>' "$f" | wc -l | tr -d ' ')
  script_close=$(grep -o '</script>' "$f" | wc -l | tr -d ' ')

  if [ "$style_open" != "$style_close" ]; then
    note_fail "$f has style tag mismatch (open=$style_open close=$style_close)"
  fi
  if [ "$script_open" != "$script_close" ]; then
    note_fail "$f has script tag mismatch (open=$script_open close=$script_close)"
  fi
done
[ "$FAIL" -eq 0 ] && note_ok "HTML style/script tag counts look balanced."

blue "-- 3) sidebar_css.html closing tag placement --"
if [ -f "./sidebar_css.html" ]; then
  style_count=$(grep -o '</style>' sidebar_css.html | wc -l | tr -d ' ')
  if [ "$style_count" -ne 1 ]; then
    note_fail "sidebar_css.html should contain exactly one </style>; found $style_count"
  else
    last_nonblank=$(awk 'NF{line=$0} END{print line}' sidebar_css.html)
    if [ "$last_nonblank" != "</style>" ]; then
      note_fail "sidebar_css.html last non-blank line is not </style>"
    else
      note_ok "sidebar_css.html closes with </style> at the end."
    fi
  fi
else
  note_warn "sidebar_css.html not found; skipped special CSS check."
fi

blue "-- 4) Extract script bodies and syntax-check with Node --"
if command -v node >/dev/null 2>&1; then
  for f in "${HTML_FILES[@]}"; do
    out="$TMP/$(basename "${f%.html}").js"

    python3 - "$f" "$out" <<'PY'
import re, sys, pathlib
src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
out = pathlib.Path(sys.argv[2])

# Extract script contents
parts = re.findall(r'<script[^>]*>(.*?)</script>', src, flags=re.S | re.I)
text = "\n\n".join(parts)

# Neutralize Apps Script template tags so Node can parse the JS
text = re.sub(r'<\?(?:!=|=).*?\?>', 'null', text, flags=re.S)

out.write_text(text, encoding="utf-8")
PY

    if [ -s "$out" ]; then
      if ! node --check "$out" >/dev/null 2>&1; then
        note_fail "$f contains JavaScript that does not parse cleanly."
        echo "  Extracted file: $out"
        node --check "$out" 2>&1 | sed 's/^/  /'
      fi
    fi
  done
  [ "$FAIL" -eq 0 ] && note_ok "Embedded HTML script blocks parse cleanly."
else
  note_warn "node not found; skipped JS syntax checks."
fi

blue "-- 5) Raw JS file syntax check --"
if command -v node >/dev/null 2>&1; then
  while IFS= read -r f; do
    if ! node --check "$f" >/dev/null 2>&1; then
      note_fail "$f does not parse cleanly."
      node --check "$f" 2>&1 | sed 's/^/  /'
    fi
  done < <(find . -maxdepth 1 -type f -name '*.js' | sort)
else
  note_warn "node not found; skipped raw JS file syntax checks."
fi

blue "-- 6) Brace/paren/bracket sanity for sidebar HTML modules --"
python3 - <<'PY'
import glob
from pathlib import Path
pairs = [('(',')'),('{','}'),('[',']')]
bad = False
for path in sorted(glob.glob("sidebar_*.html")):
    text = Path(path).read_text(encoding="utf-8")
    for a, b in pairs:
        ca, cb = text.count(a), text.count(b)
        if ca != cb:
            print(f"FAIL: {path} unmatched counts: {a}={ca} {b}={cb}")
            bad = True
if not bad:
    print("OK: sidebar_*.html delimiter counts are balanced.")
PY

blue "-- 7) Duplicate function detection --"
while IFS= read -r line; do
  case "$line" in
    FAIL:*) note_fail "${line#FAIL: }" ;;
    WARN:*) note_warn "${line#WARN: }" ;;
    OK:*)   note_ok   "${line#OK: }" ;;
  esac
done < <(python3 - <<'PY'
import re, glob
from pathlib import Path
from collections import defaultdict

NAMED_FUNC = re.compile(r'\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(')
func_to_files = defaultdict(set)

for path in sorted(glob.glob("*.html")):
    text = Path(path).read_text(encoding="utf-8")
    parts = re.findall(r'<script[^>]*>(.*?)</script>', text, flags=re.S | re.I)
    body = "\n".join(parts)
    for m in NAMED_FUNC.finditer(body):
        func_to_files[m.group(1)].add(path)

for path in sorted(glob.glob("*.js")):
    text = Path(path).read_text(encoding="utf-8")
    for m in NAMED_FUNC.finditer(text):
        func_to_files[m.group(1)].add(path)

dups = {name: sorted(files) for name, files in func_to_files.items() if len(files) > 1}
if dups:
    for name, files in sorted(dups.items()):
        print(f"FAIL: duplicate function '{name}' in: {', '.join(files)}")
else:
    print("OK: No duplicate named function definitions across files.")
PY
)

blue "-- 8) Search wiring smoke check --"
missing=0
for pat in '#run-sefaria' 'runUnifiedQuery' 'findReference' 'findSearchAdvanced'; do
  if ! grep -ql "$pat" *.html Code.gs 2>/dev/null; then
    note_fail "Could not find expected search token: $pat"
    missing=1
  fi
done
[ "$missing" -eq 0 ] && note_ok "Core search wiring tokens are present."

blue "-- 9) Orphaned file detection --"
while IFS= read -r line; do
  case "$line" in
    FAIL:*) note_fail "${line#FAIL: }" ;;
    WARN:*) note_warn "${line#WARN: }" ;;
    OK:*)   note_ok   "${line#OK: }" ;;
  esac
done < <(python3 - <<'PY'
import re, glob
from pathlib import Path

TOP_LEVEL = {
    'sidebar.html', 'preferences.html', 'ai_lesson.html',
    'surprise-me.html', 'help.html', 'support.html', 'release-notes.html'
}

INCLUDE_RE = re.compile(r"""include\s*\(\s*['"]([^'"]+)['"]\s*\)""")
referenced = set()

for path in sorted(glob.glob("*.html") + glob.glob("*.gs") + glob.glob("*.js")):
    text = Path(path).read_text(encoding="utf-8")
    for m in INCLUDE_RE.finditer(text):
        referenced.add(m.group(1).strip())

all_html = {Path(p).name for p in glob.glob("*.html")}
candidates = sorted(all_html - TOP_LEVEL)

found_orphan = False
for f in candidates:
    stem = Path(f).stem
    if stem not in referenced:
        print(f"WARN: possibly orphaned file: {f}")
        found_orphan = True
if not found_orphan:
    print("OK: All non-template HTML files are referenced by an include() directive.")
PY
)

blue "-- 10) Optional: clasp status --"
if command -v clasp >/dev/null 2>&1; then
  if clasp status >/dev/null 2>&1; then
    note_ok "clasp status succeeded."
  else
    note_warn "clasp status reported an issue."
  fi
else
  note_warn "clasp not found; skipped clasp status check."
fi

echo
blue "== Summary =="
if [ "$FAIL" -gt 0 ]; then
  red "Pre-clasp QC found $FAIL failure(s) and $WARN warning(s)."
  echo "Temporary extracted files are in: $TMP"
  exit 1
else
  green "Pre-clasp QC passed with $WARN warning(s)."
  rm -rf "$TMP"
  exit 0
fi
