#!/usr/bin/env bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
DIR="$(cd "$(dirname "$0")" && pwd -W)"
OUT="$("$EDGE" --headless=new --disable-gpu --user-data-dir="$TMP/quiz-edge-profile" \
  --dump-dom "file:///$DIR/test.html" 2>/dev/null | grep -oE '(PASS|FAIL|SUMMARY)[^<]*')"
echo "$OUT"
echo "$OUT" | grep -q '^SUMMARY passed=[0-9]* failed=0$'
