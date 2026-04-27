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

# Collect files (recursively, so nested `sidebar/`, `css/`, `preferences/`, etc. are scanned)
mapfile -t ALL_FILES < <(find . -type f \( -name '*.gs' -o -name '*.html' -o -name '*.js' -o -name '*.css' \) | sort)
mapfile -t HTML_FILES < <(find . -type f -name '*.html' | sort)

if [ "${#ALL_FILES[@]}" -eq 0 ]; then
  note_fail "No .gs/.html/.js/.css files found in $ROOT."
  exit 1
fi

blue "-- 1) Basename collision check (clasp flattens nested paths) --"
# clasp flattens nested paths using '/' -> '/' (it preserves subdirs), so a same
# basename in two different subdirs is actually fine. But *.gs files must be
# uniquely named regardless of directory, since GAS puts all .gs into one
# global scope. Also a .html in two subdirs is fine because include() uses the
# relative path. So we only check .gs basenames here.
dups=$(
  printf '%s\n' "${ALL_FILES[@]}" \
  | grep '\.gs$' \
  | sed 's#.*/##' \
  | sed 's/\.[^.]*$//' \
  | sort \
  | uniq -d
)
if [ -n "$dups" ]; then
  note_fail "Duplicate .gs basenames found (all .gs share one global scope):"
  printf '%s\n' "$dups" | sed 's/^/  - /'
else
  note_ok "No duplicate .gs basenames."
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

blue "-- 3) CSS partial closing-tag sanity --"
# Every css/*.html partial should be a pure CSS fragment wrapped in a single
# <style>...</style> pair and end with </style>.
css_fail=0
while IFS= read -r f; do
  style_count=$(grep -o '</style>' "$f" | wc -l | tr -d ' ')
  if [ "$style_count" -ne 1 ]; then
    note_fail "$f should contain exactly one </style>; found $style_count"
    css_fail=1
    continue
  fi
  last_nonblank=$(awk 'NF{line=$0} END{print line}' "$f")
  if [ "$last_nonblank" != "</style>" ]; then
    note_fail "$f last non-blank line is not </style>"
    css_fail=1
  fi
done < <(find . -type f -path '*/css/*.html' | sort)
[ "$css_fail" -eq 0 ] && note_ok "All css/**/*.html partials close with </style>."

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
  done < <(find . -type f -name '*.js' | sort)
else
  note_warn "node not found; skipped raw JS file syntax checks."
fi

blue "-- 6) Duplicate function detection (include-graph aware) --"
while IFS= read -r line; do
  case "$line" in
    FAIL:*) note_fail "${line#FAIL: }" ;;
    WARN:*) note_warn "${line#WARN: }" ;;
    OK:*)   note_ok   "${line#OK: }" ;;
  esac
done < <(python3 - <<'PY'
import re, os
from pathlib import Path
from collections import defaultdict

NAMED_FUNC = re.compile(r'\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(')
INCLUDE_RE = re.compile(r"""include\s*\(\s*['\"]([^'\"]+)['\"]\s*\)""")

# Each of these is its own HtmlService output (sidebar / dialog / modal);
# their <script> bodies never co-exist on a page.
ENTRY_TEMPLATES = [
    "sidebar.html", "preferences.html", "ai_lesson.html", "surprise-me.html",
    "help-modal.html", "feedback-modal.html", "release-notes.html",
    "gematriya-count.html", "session-library-modal.html",
]

def walk(exts):
    for dirpath, _dirs, files in os.walk("."):
        if "node_modules" in dirpath.split(os.sep):
            continue
        for name in files:
            if any(name.endswith(ext) for ext in exts):
                yield os.path.join(dirpath, name)

def norm(rel_html):
    return rel_html[2:] if rel_html.startswith("./") else rel_html

# Map "include key" (e.g. "sidebar/js/bootstrap") -> actual path "sidebar/js/bootstrap.html"
html_paths_by_key = {}
for path in sorted(walk([".html"])):
    rel = norm(path).replace(os.sep, "/")
    key = rel[:-len(".html")]
    html_paths_by_key[key] = rel

# Build include graph: file -> set of included file paths
includes = defaultdict(set)
for rel in html_paths_by_key.values():
    text = Path(rel).read_text(encoding="utf-8")
    for m in INCLUDE_RE.finditer(text):
        ref = m.group(1).strip()
        if ref in html_paths_by_key:
            includes[rel].add(html_paths_by_key[ref])

# For each entry template, compute the transitive closure of reachable HTML partials.
def reachable_from(entry):
    visited = {entry}
    stack = [entry]
    while stack:
        cur = stack.pop()
        for nxt in includes.get(cur, ()):
            if nxt not in visited:
                visited.add(nxt)
                stack.append(nxt)
    return visited

entry_subtrees = {}
for entry in ENTRY_TEMPLATES:
    if entry in html_paths_by_key.values() or Path(entry).exists():
        entry_subtrees[entry] = reachable_from(entry)

# Collect function name -> set of files where defined.
func_to_html = defaultdict(set)
for rel in html_paths_by_key.values():
    text = Path(rel).read_text(encoding="utf-8")
    parts = re.findall(r'<script[^>]*>(.*?)</script>', text, flags=re.S | re.I)
    body = "\n".join(parts)
    for m in NAMED_FUNC.finditer(body):
        func_to_html[m.group(1)].add(rel)

# A duplicate is a real collision iff there is some entry subtree that contains
# at least two of the defining files.
real_collisions = {}
for name, files in func_to_html.items():
    if len(files) < 2:
        continue
    for entry, subtree in entry_subtrees.items():
        shared = files & subtree
        if len(shared) > 1:
            real_collisions.setdefault(name, set()).update(shared)
            real_collisions[name].add(f"(in {entry})")
            break

# .gs files always share one global scope at runtime — any duplicate is real.
gs_func_to_files = defaultdict(set)
for path in sorted(walk([".gs"])):
    text = Path(path).read_text(encoding="utf-8")
    for m in NAMED_FUNC.finditer(text):
        gs_func_to_files[m.group(1)].add(norm(path))
for name, files in gs_func_to_files.items():
    if len(files) > 1:
        real_collisions.setdefault(name, set()).update(files)
        real_collisions[name].add("(in .gs global scope)")

if real_collisions:
    for name, files in sorted(real_collisions.items()):
        print(f"FAIL: duplicate function '{name}' collides in: {', '.join(sorted(files))}")
else:
    print("OK: No duplicate named function definitions where scopes actually collide.")
PY
)

blue "-- 7) Search wiring smoke check --"
missing=0
for pat in '#run-sefaria' 'runUnifiedQuery' 'findReference' 'findSearchAdvanced'; do
  if ! grep -rqlF --include='*.html' --include='*.gs' "$pat" . 2>/dev/null; then
    note_fail "Could not find expected search token: $pat"
    missing=1
  fi
done
[ "$missing" -eq 0 ] && note_ok "Core search wiring tokens are present."

blue "-- 8) Orphaned file detection --"
while IFS= read -r line; do
  case "$line" in
    FAIL:*) note_fail "${line#FAIL: }" ;;
    WARN:*) note_warn "${line#WARN: }" ;;
    OK:*)   note_ok   "${line#OK: }" ;;
  esac
done < <(python3 - <<'PY'
import os, re
from pathlib import Path

# Treat these as top-level entry-point templates; they don't need to be
# `include()`d from another template to be considered in use.
ENTRY_TEMPLATES = {
    "sidebar.html", "preferences.html", "ai_lesson.html",
    "surprise-me.html", "help-modal.html", "feedback-modal.html",
    "release-notes.html", "gematriya-count.html",
    "session-library-modal.html",
}

INCLUDE_RE = re.compile(r"""include\s*\(\s*['\"]([^'\"]+)['\"]\s*\)""")

def walk(exts):
    for dirpath, _dirs, files in os.walk("."):
        if "node_modules" in dirpath.split(os.sep):
            continue
        for name in files:
            if any(name.endswith(ext) for ext in exts):
                yield os.path.join(dirpath, name)

referenced = set()
all_html = []
for path in sorted(walk([".html", ".gs", ".js"])):
    text = Path(path).read_text(encoding="utf-8")
    for m in INCLUDE_RE.finditer(text):
        referenced.add(m.group(1).strip())
    if path.endswith(".html"):
        all_html.append(path)

# For HTML files, check whether their include-key (path relative to rootDir,
# minus the .html suffix) appears in the set of referenced includes.
found_orphan = False
for path in all_html:
    name = os.path.basename(path)
    if name in ENTRY_TEMPLATES:
        continue
    rel = os.path.relpath(path, ".").replace(os.sep, "/")
    include_key = rel[:-len(".html")]
    if include_key not in referenced:
        print(f"WARN: possibly orphaned file: {rel}")
        found_orphan = True

if not found_orphan:
    print("OK: All non-entry HTML files are referenced by an include() directive.")
PY
)

blue "-- 9) innerHTML writes must have an adjacent justification comment --"
while IFS= read -r line; do
  case "$line" in
    FAIL:*) note_fail "${line#FAIL: }" ;;
    WARN:*) note_warn "${line#WARN: }" ;;
    OK:*)   note_ok   "${line#OK: }" ;;
  esac
done < <(python3 - <<'PY'
# Any `.innerHTML =` write in a shipped .html file must have a comment on the
# line immediately above it, or anywhere in the preceding 5 lines, explaining
# why textContent + document.createElement is not appropriate. This catches
# the common "quick fix that introduces XSS" anti-pattern before clasp push.
import os, re
from pathlib import Path

INNER_HTML_ASSIGN = re.compile(r'\.\s*innerHTML\s*=')
COMMENT_LINE = re.compile(r'^\s*(//|/\*|\*)')  # JS single-line, block-start, or continuation

unannotated = []
for dirpath, _dirs, files in os.walk("."):
    if "node_modules" in dirpath.split(os.sep):
        continue
    for name in files:
        if not name.endswith(".html"):
            continue
        path = os.path.join(dirpath, name)
        try:
            text = Path(path).read_text(encoding="utf-8")
        except Exception:
            continue
        lines = text.split("\n")
        for i, ln in enumerate(lines):
            if not INNER_HTML_ASSIGN.search(ln):
                continue
            # Walk the preceding 5 lines looking for a comment.
            lo = max(0, i - 5)
            found_comment = any(COMMENT_LINE.match(lines[j]) for j in range(lo, i))
            if not found_comment:
                unannotated.append(f"{path}:{i+1}: {ln.strip()}")

if unannotated:
    print("FAIL: Unannotated `.innerHTML =` writes — add a justification comment or switch to textContent:")
    for u in unannotated:
        print("  - " + u)
else:
    print("OK: Every .innerHTML assignment has an adjacent justification comment.")
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
