#!/usr/bin/env bash
# src/의 html을 암호화해 docs/에 저장하고 커밋·푸시한다.
# 비밀번호: STATICRYPT_PASSWORD 환경변수가 있으면 그걸 쓰고, 없으면 화면에 안 보이게 입력받는다.
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${STATICRYPT_PASSWORD:-}" ]; then
  read -rsp "비밀번호: " p1; echo
  read -rsp "비밀번호 확인: " p2; echo
  [ "$p1" = "$p2" ] || { echo "비밀번호가 서로 달라요. 중단합니다."; exit 1; }
  [ -n "$p1" ] || { echo "비밀번호가 비어 있어요. 중단합니다."; exit 1; }
  export STATICRYPT_PASSWORD="$p1"
  unset p1 p2
fi

# 1. 암호화 (src/에서 지운 페이지가 docs/에 남지 않게 먼저 비움)
rm -f docs/*.html
cd src
npx --no-install staticrypt ./*.html -d ../docs -c ../.staticrypt.json \
  --remember 30 --short \
  --template-title "예슬 논술 노트" \
  --template-instructions "비밀번호를 입력하세요." \
  --template-placeholder "비밀번호" \
  --template-button "열기" \
  --template-remember "이 기기 기억하기 (30일)" \
  --template-error "비밀번호가 틀렸어요." \
  --template-toggle-show "비밀번호 보기" \
  --template-toggle-hide "비밀번호 숨기기" \
  --template-color-primary "#1f5fbf" \
  --template-color-secondary "#f4f5f7"
cd ..
unset STATICRYPT_PASSWORD

# 2. 푸시 전 확인
fail=0
for f in src/*.html; do
  out="docs/$(basename "$f")"
  if [ ! -f "$out" ] || ! grep -q "staticryptConfig" "$out"; then
    echo "✗ $out 이(가) 없거나 암호화되지 않았어요."; fail=1
  fi
done
if grep -rl "을국" docs/ >/dev/null 2>&1; then
  echo "✗ docs/에 평문이 있어요 (grep -r \"을국\" docs/):"; grep -rl "을국" docs/; fail=1
fi
git add -A
if git ls-files --cached src | grep -q . || git status --porcelain | grep -q " src/"; then
  echo "✗ src/가 커밋 대상에 들어 있어요."; git status --short; fail=1
fi
if [ "$fail" -ne 0 ]; then
  git reset -q
  echo "확인에 실패해서 커밋·푸시하지 않았어요."
  exit 1
fi
echo "✓ src/는 커밋 대상에 없음, docs/에 평문 없음"

# 3. 커밋·푸시
if git diff --cached --quiet; then
  echo "바뀐 내용이 없어서 커밋하지 않았어요."
else
  git commit -q -m "배포 $(date '+%Y-%m-%d %H:%M')"
  echo "✓ 커밋함"
fi
git push -q origin main
echo "✓ 푸시함"
