#!/usr/bin/env bash
# 安装 dsh-computer-use-ng 到 DSH（home 级用户 patch 层）。
#
# 原理（dsh profile-boot）：
#   patch 层顺序 = bundle → profile 层 → HOME 层（$DSH_HOME/cordis.patch.yml）→ --patch
#   我们在 HOME 层 insert 插件，不修改 profile 配置，卸载也干净。
#
# 优先推荐使用 DSH 插件管理器：
#   dsh plugin --profile desktop add github:AndroidSix/dsh-computer-use-ng
#
# 用法: ./install.sh [--dry-run]    卸载: ./uninstall.sh
set -euo pipefail

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

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
SRC="$(cd "$(dirname "$0")" && pwd)"

PROFILE="${DSH_PROFILE:-}"
if [ -z "$PROFILE" ]; then
  for candidate in desktop web; do
    if [ -d "$DSH_HOME/profiles/$candidate" ]; then
      PROFILE="$candidate"
      break
    fi
  done
fi

echo "== dsh-computer-use-ng install (home patch layer) =="
echo "  DSH_HOME: $DSH_HOME"
echo "  profile : ${PROFILE:-未找到}"
echo "  source  : $SRC"

[ -n "$PROFILE" ] || { echo "错误: 未找到 desktop/web profile，请先启动一次 DSH 或设置 DSH_PROFILE。"; exit 1; }
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
NM_DIR="$PROFILE_DIR/node_modules"
[ -d "$NM_DIR" ] || { echo "错误: 未找到 $NM_DIR"; exit 1; }

if [ -f "$PROFILE_DIR/package.json" ] && grep -q '"dsh-computer-use-ng"' "$PROFILE_DIR/package.json"; then
  echo "错误: profile 已通过插件管理器声明 dsh-computer-use-ng。"
  echo "      请用 dsh plugin 管理，或先移除该依赖后再运行 install.sh。"
  exit 1
fi

if [ -f "$PROFILE_DIR/package.json" ] && grep -q '"dsh-computer-use"' "$PROFILE_DIR/package.json"; then
  echo "错误: profile 仍安装旧版 dsh-computer-use，会与 dsh-computer-use-ng 重复注册同名工具。"
  echo "      请先运行: dsh plugin --profile $PROFILE remove dsh-computer-use"
  exit 1
fi

# 1. 链接插件包到 profile 的 node_modules（加载器从 profile node_modules 解析插件名）
if [ "$DRY_RUN" = 1 ]; then
  echo "  [dry-run] ln -sfn $SRC -> $NM_DIR/dsh-computer-use-ng"
else
  ln -sfn "$SRC" "$NM_DIR/dsh-computer-use-ng"
  echo "  [ok] 插件包已链接"
fi

# 2. 在 home 级 patch 层注册（幂等：已存在则跳过）
PATCH="$DSH_HOME/cordis.patch.yml"
if [ "$DRY_RUN" = 1 ]; then
  echo "  [dry-run] 写入 $PATCH : insert dsh-computer-use-ng"
else
  touch "$PATCH"
  if grep -q "dsh-computer-use-ng" "$PATCH"; then
    echo "  [ok] $PATCH 已含 dsh-computer-use-ng（跳过）"
  else
    {
      printf '# dsh-computer-use-ng 用户级注册（install.sh 生成）\n'
      printf -- '- insert:\n'
      printf '    - id: dsh-computer-use-ng\n'
      printf '      name: dsh-computer-use-ng\n'
      printf '      config:\n'
      printf '        ttlMs: 30000\n'
      printf '        maxElements: 500\n'
    } >> "$PATCH"
    echo "  [ok] 已写入 $PATCH"
  fi
fi

if [ "$DRY_RUN" = 1 ]; then
  echo "== 预演完成（未写入任何文件）=="
else
  echo "== 安装完成，请重启 DSH 生效 =="
fi
