#!/usr/bin/env bash
# 卸载 dsh-computer-use-ng（移除 home patch 层注册 + 插件链接）。
# 如果是通过 DSH 插件管理器安装的，请改用：
#   dsh plugin --profile desktop remove dsh-computer-use-ng
set -euo pipefail

DEFAULT_DSH_HOME="$HOME/.dsh"
LEGACY_DSH_HOME="$HOME/Library/Application Support/harness-desktop/dsh-home"
DSH_HOME="${DSH_HOME:-}"
if [ -z "$DSH_HOME" ]; then
  if [ -d "$DEFAULT_DSH_HOME" ]; then
    DSH_HOME="$DEFAULT_DSH_HOME"
  else
    DSH_HOME="$LEGACY_DSH_HOME"
  fi
fi
PATCH="$DSH_HOME/cordis.patch.yml"

PROFILE="${DSH_PROFILE:-}"
if [ -z "$PROFILE" ]; then
  for candidate in desktop web; do
    if [ -d "$DSH_HOME/profiles/$candidate" ]; then
      PROFILE="$candidate"
      break
    fi
  done
fi

echo "== dsh-computer-use-ng uninstall =="
echo "  DSH_HOME: $DSH_HOME"
echo "  profile : ${PROFILE:-未找到}"

if [ -f "$PATCH" ]; then
  python3 - "$PATCH" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p).read()
# 移除 install.sh 生成的块（从 '# dsh-computer-use-ng 用户级注册' 到下一个顶层条目前）
before = s
s = re.sub(r'\n?# dsh-computer-use-ng 用户级注册（install\.sh 生成）\n(?:- insert:\n(?:[ \t]+.*\n?)*)', '\n', s, count=1)
s = s.strip('\n') + '\n'
open(p, 'w').write(s)
print('  [ok] 已从', p, '移除注册块' if s != before else '（未找到注册块）')
PY
else
  echo "  [skip] 无 patch 文件"
fi

if [ -n "$PROFILE" ]; then
  rm -f "$DSH_HOME/profiles/$PROFILE/node_modules/dsh-computer-use-ng"
fi

if [ -n "$PROFILE" ] && [ -f "$DSH_HOME/profiles/$PROFILE/package.json" ] && grep -q '"dsh-computer-use-ng"' "$DSH_HOME/profiles/$PROFILE/package.json"; then
  echo "  [warn] profile 仍通过插件管理器声明 dsh-computer-use-ng。"
  echo "         请运行: dsh plugin --profile $PROFILE remove dsh-computer-use-ng"
fi

echo "== 卸载完成，请重启 DSH 生效 =="
