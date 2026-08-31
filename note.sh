#!/usr/bin/env bash
# 一键发随笔：bash note.sh 随笔内容
# 内容会带上当前时间戳插入 brevity.yml 顶部，提交并推送（推送后约1分钟上线）
set -e
cd "$(dirname "$0")"

if [ "$1" = "--dry" ]; then
  shift
  dry=1
else
  dry=0
fi

text="$*"
if [ -z "$text" ]; then
  read -rp "写点什么: " text
fi
[ -z "$text" ] && { echo "没写内容，取消"; exit 1; }

# 多行压成一行，转义反斜杠和双引号，保证 YAML 合法
text=$(printf '%s' "$text" | tr '\n' ' ' | sed 's/\\/\\\\/g; s/"/\\"/g')
stamp=$(date "+%Y-%m-%d %H:%M")

tmp=$(mktemp)
{
  echo "- content: \"$text\""
  echo "  date: $stamp"
  cat source/_data/brevity.yml
} > "$tmp" && mv "$tmp" source/_data/brevity.yml

if [ "$dry" = "1" ]; then
  echo "--- 预览模式，未发布。brevity.yml 顶部内容： ---"
  head -4 source/_data/brevity.yml
  git checkout -q source/_data/brevity.yml
  exit 0
fi

git add source/_data/brevity.yml
git commit -q -m "发一条随笔"
git push -q
echo "✅ 已发布: $text"
