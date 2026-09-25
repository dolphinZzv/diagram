#!/usr/bin/env bash
#
# Diagram 一键安装 / 更新脚本
# One-click install / update script for Diagram.
#
# 用法 / Usage:
#   curl -fsSL https://raw.githubusercontent.com/dolphinZzv/diagram/main/install.sh | bash
#
#   # 安装指定版本 / install a specific version
#   curl -fsSL .../install.sh | VERSION=v1.0.0 bash
#
#   # 自定义安装目录 / custom install dir
#   curl -fsSL .../install.sh | INSTALL_DIR=$HOME/bin bash
#
#   # 更新 (重新运行即可) / update by running again
#   diagram update      # 内置自更新 / built-in self update
#   bash install.sh     # 或重新执行本脚本 / or re-run this script
#
# 环境变量 / Env vars:
#   VERSION       版本 tag, 默认 latest           (default: latest)
#   INSTALL_DIR   安装目录, 默认自动选择           (default: auto)
#   NO_SUDO=1     禁止使用 sudo                   (disable sudo)
#
set -euo pipefail

REPO="dolphinZzv/diagram"
BIN="diagram"
VERSION="${VERSION:-latest}"

# ---------- pretty output ----------
if [ -t 1 ]; then
  BOLD="\033[1m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; DIM="\033[2m"; RESET="\033[0m"
else
  BOLD=""; GREEN=""; YELLOW=""; RED=""; DIM=""; RESET=""
fi
info()  { printf "${BOLD}${GREEN}==>${RESET} ${BOLD}%s${RESET}\n" "$*"; }
warn()  { printf "${YELLOW}warning:${RESET} %s\n" "$*" >&2; }
error() { printf "${RED}error:${RESET} %s\n" "$*" >&2; exit 1; }

# ---------- detect platform ----------
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH="amd64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) error "不支持的架构 / unsupported architecture: $ARCH" ;;
esac
case "$OS" in
  linux|darwin) ;;
  mingw*|msys*|cygwin*) error "Windows 请使用 PowerShell 或直接下载 .zip 发行包 / use the .zip release on Windows" ;;
  *) error "不支持的系统 / unsupported OS: $OS" ;;
esac

ASSET="${BIN}_${OS}_${ARCH}.tar.gz"

# ---------- download tool ----------
if command -v curl >/dev/null 2>&1; then
  DL="curl -fL --retry 3 --connect-timeout 15 -o"
elif command -v wget >/dev/null 2>&1; then
  DL="wget -q --show-progress -O"
else
  error "需要 curl 或 wget / curl or wget is required"
fi

# ---------- resolve download url ----------
if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
  SUM_URL="https://github.com/${REPO}/releases/latest/download/checksums.txt"
else
  case "$VERSION" in v*) ;; *) VERSION="v${VERSION}" ;; esac
  URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"
  SUM_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"
fi

info "平台 / platform: ${OS}/${ARCH}"
info "版本 / version:  ${VERSION}"
info "下载 / download: ${URL}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

$DL "$TMP/$ASSET" "$URL" || error "下载失败 / download failed"

# ---------- checksum (optional) ----------
if command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1; then
  if $DL "$TMP/checksums.txt" "$SUM_URL" >/dev/null 2>&1; then
    EXPECTED="$(grep " ${ASSET}\$" "$TMP/checksums.txt" | awk '{print $1}' || true)"
    if [ -n "${EXPECTED:-}" ]; then
      if command -v sha256sum >/dev/null 2>&1; then
        ACTUAL="$(sha256sum "$TMP/$ASSET" | awk '{print $1}')"
      else
        ACTUAL="$(shasum -a 256 "$TMP/$ASSET" | awk '{print $1}')"
      fi
      [ "$EXPECTED" = "$ACTUAL" ] || error "校验和不匹配 / checksum mismatch"
      info "校验通过 / checksum verified ✓"
    fi
  else
    warn "无法获取 checksums.txt, 跳过校验 / skipping checksum"
  fi
fi

# ---------- extract ----------
tar -xzf "$TMP/$ASSET" -C "$TMP"
[ -f "$TMP/$BIN" ] || error "压缩包中未找到 $BIN / binary not found in archive"
chmod +x "$TMP/$BIN"

# ---------- choose install dir ----------
if [ -n "${INSTALL_DIR:-}" ]; then
  DIR="$INSTALL_DIR"
  mkdir -p "$DIR" 2>/dev/null || true
elif [ -w "/usr/local/bin" ]; then
  DIR="/usr/local/bin"
else
  DIR="$HOME/.local/bin"
  mkdir -p "$DIR"
fi

install_bin() {
  if [ -w "$DIR" ]; then
    mv "$TMP/$BIN" "$DIR/$BIN"
  else
    [ "${NO_SUDO:-0}" = "1" ] && error "无写入权限且已禁用 sudo / no write permission to $DIR"
    info "需要管理员权限写入 $DIR / using sudo"
    sudo mkdir -p "$DIR"
    sudo mv "$TMP/$BIN" "$DIR/$BIN"
  fi
  chmod +x "$DIR/$BIN" 2>/dev/null || sudo chmod +x "$DIR/$BIN"
}

# If replacing a running binary on unix, mv works fine.
install_bin

info "已安装到 / installed to: ${DIR}/${BIN}"

# ---------- PATH hint ----------
case ":$PATH:" in
  *":$DIR:"*) ;;
  *)
    warn "${DIR} 不在 PATH 中, 请添加以下内容到 shell 配置:"
    printf "    ${DIM}export PATH=\"%s:\$PATH\"${RESET}\n" "$DIR"
    ;;
esac

# ---------- verify ----------
if "$DIR/$BIN" version >/dev/null 2>&1; then
  printf "${GREEN}✓ 安装成功${RESET} — ${DIM}%s${RESET}\n" "$("$DIR/$BIN" version)"
else
  warn "安装完成但无法执行, 请检查架构是否匹配 / installed but not runnable, check architecture"
fi

cat <<EOF

${BOLD}下一步 / Next steps:${RESET}
  启动服务 / start server:   ${BIN}
  然后打开 / open:           http://localhost:8080
  自定义端口 / custom port:  ${BIN} -addr :9000
  更新版本 / update:         ${BIN} update

EOF
