#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8765}"
CHROME="${CHROME:-google-chrome}"

if ! command -v "$CHROME" >/dev/null 2>&1; then
  echo "未找到 $CHROME，跳过无 GUI 浏览器测试。"
  exit 0
fi

if ! curl -sf "http://127.0.0.1:${PORT}/gallery/manifest.json" >/dev/null; then
  echo "请先在仓库根目录启动本地预览服务，例如: python3 -m http.server ${PORT} --bind 127.0.0.1" >&2
  exit 1
fi

run_one() {
  local path="$1"
  local name="$2"
  local dump="/tmp/xh-${name}-dump.html"
  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --window-size=1280,900 --virtual-time-budget=40000 --timeout=50000 \
    --dump-dom "http://127.0.0.1:${PORT}/${path}" > "$dump"
  if grep -q "ALL_PASSED" "$dump"; then
    echo "浏览器无 GUI 测试通过（${name}）："
    grep -E 'ok -|ALL_PASSED' "$dump" | sed 's/<[^>]*>//g' | sed '/^$/d'
    return 0
  fi
  echo "浏览器无 GUI 测试失败（${name}），输出片段：" >&2
  grep -E 'FAIL|ok -|running' "$dump" | sed 's/<[^>]*>//g' | tail -n 60 >&2
  return 1
}

run_one "tests/browser-test.html" "gallery-logic"
run_one "tests/browser-display-test.html" "gallery-display"
