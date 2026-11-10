#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8765}"
CHROME="${CHROME:-google-chrome}"
URL="http://127.0.0.1:${PORT}/tests/browser-test.html"

if ! command -v "$CHROME" >/dev/null 2>&1; then
  echo "未找到 $CHROME，跳过无 GUI 浏览器测试。"
  exit 0
fi

dump="/tmp/xh-browser-dump.html"
if ! curl -sf "http://127.0.0.1:${PORT}/gallery/manifest.json" >/dev/null; then
  echo "请先在仓库根目录启动本地预览服务，例如: python3 -m http.server ${PORT} --bind 127.0.0.1" >&2
  exit 1
fi

"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --virtual-time-budget=20000 --timeout=30000 --dump-dom "$URL" > "$dump"

if grep -q "ALL_PASSED" "$dump"; then
  echo "浏览器无 GUI 测试通过："
  grep -E 'ok -|ALL_PASSED' "$dump" | sed 's/<[^>]*>//g' | sed '/^$/d'
  exit 0
fi
echo "浏览器无 GUI 测试失败，输出片段：" >&2
grep -E 'FAIL|ok -|running' "$dump" | sed 's/<[^>]*>//g' | tail -n 40 >&2
exit 1
