#!/usr/bin/env bash
# Open Anvil — Install Script
# Supports: macOS, Linux (Windows: use install.ps1)
# Usage: ./install.sh [install|uninstall] [extension_id]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="1.2.0"

# ─── Platform Detection ────────────────────────────────────────────────────
detect_platform() {
  case "$(uname -s)" in
    Darwin)  echo "macos" ;;
    Linux)   echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

PLATFORM=$(detect_platform)

# ─── Path Resolution ───────────────────────────────────────────────────────
case "$PLATFORM" in
  macos)
    # Chrome user-level native messaging
    CHROME_NM_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    CHROMIUM_NM_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
    CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/open-anvil"
    ;;
  linux)
    CHROME_NM_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    CHROMIUM_NM_DIR="$HOME/.config/chromium/NativeMessagingHosts"
    CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/open-anvil"
    ;;
  windows)
    echo "Windows is not supported by this script. Use install.ps1 instead."
    exit 1
    ;;
esac

MCP_SERVER="$SCRIPT_DIR/mcp-server/server.js"
NATIVE_HOST="${NATIVE_HOST_PATH:-$SCRIPT_DIR/../FloydTTYBridge/extension/native_host.py}"
NM_MANIFEST="$CHROME_NM_DIR/com.floyd.tty.json"

# ─── Helpers ───────────────────────────────────────────────────────────────
print_header() {
  echo ""
  echo "  Open Anvil v${VERSION} — Installer"
  echo "  ================================"
  echo "  Platform: ${PLATFORM}"
  echo ""
}

info()  { echo "  [+] $1"; }
warn()  { echo "  [!] $1"; }
error() { echo "  [✗] $1" >&2; exit 1; }

check_prereqs() {
  if ! command -v node &>/dev/null; then
    error "Node.js is required (v18+). Install from https://nodejs.org"
  fi
  if ! command -v python3 &>/dev/null; then
    error "Python 3 is required. Install from https://python.org"
  fi
  local node_ver
  node_ver=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$node_ver" -lt 18 ]]; then
    error "Node.js v18+ required. Found v${node_ver}."
  fi
}

install_deps() {
  info "Installing MCP server dependencies..."
  (cd "$SCRIPT_DIR/mcp-server" && npm install --production 2>/dev/null)
  info "Dependencies installed."
}

generate_token() {
  mkdir -p "$CONFIG_DIR"
  local token_file="$CONFIG_DIR/token"
  if [[ -f "$token_file" ]]; then
    info "WS token already exists at $token_file"
  else
    local token
    token=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
    echo "$token" > "$token_file"
    chmod 600 "$token_file"
    info "Generated WS token: $token"
    info "Token saved to $token_file"
  fi
}

register_native_host() {
  local ext_id="${1:-}"
  local ext_id2="${2:-}"

  if [[ -z "$ext_id" ]]; then
    warn "No extension ID provided. Native messaging bridge will be unavailable."
    warn "Re-run: $0 install <extension_id> [second_extension_id]"
    warn "Find extension IDs at chrome://extensions (enable Developer mode)"
    return 0
  fi

  mkdir -p "$CHROME_NM_DIR"

  local origins="    \"chrome-extension://${ext_id}/\""
  if [[ -n "$ext_id2" ]]; then
    origins="${origins},
    \"chrome-extension://${ext_id2}/\""
  fi

  cat > "$NM_MANIFEST" <<EOF
{
  "name": "com.floyd.tty",
  "description": "Floyd's Labs TTY Bridge + Open Anvil MCP Bridge",
  "path": "${NATIVE_HOST}",
  "type": "stdio",
  "allowed_origins": [
${origins}
  ]
}
EOF

  chmod 644 "$NM_MANIFEST"
  info "Native messaging host registered at $NM_MANIFEST"
}

write_config() {
  mkdir -p "$CONFIG_DIR"
  cat > "$CONFIG_DIR/config.json" <<EOF
{
  "version": "${VERSION}",
  "platform": "${PLATFORM}",
  "wsPort": 7777,
  "wsPortStdio": 7778,
  "mcpServerPath": "${MCP_SERVER}",
  "tokenFile": "${CONFIG_DIR}/token",
  "shellEnabled": false
}
EOF
  info "Config written to $CONFIG_DIR/config.json"
}

uninstall() {
  info "Removing native messaging host..."
  rm -f "$NM_MANIFEST"
  rmdir "$CHROME_NM_DIR" 2>/dev/null || true
  info "Removing config directory..."
  rm -rf "$CONFIG_DIR"
  info "Uninstall complete."
  echo ""
  echo "  Note: MCP server dependencies were not removed."
  echo "  To remove them: rm -rf ${SCRIPT_DIR}/mcp-server/node_modules"
}

# ─── Main ──────────────────────────────────────────────────────────────────
print_header
check_prereqs

case "${1:-install}" in
  install)
    install_deps
    generate_token
    write_config
    register_native_host "${2:-}" "${3:-}"
    echo ""
    echo "  Installation complete."
    echo ""
    echo "  Next steps:"
    echo "    1. Load the Open Anvil extension in Chrome (chrome://extensions)"
    echo "    2. Extension badge should show ● (purple) if native host is running"
    echo "    3. Enable shell access: export ANVIL_SHELL=true (optional)"
    echo ""
    ;;
  uninstall)
    uninstall
    ;;
  token)
    generate_token
    ;;
  *)
    echo "Usage: $0 [install|uninstall|token] [extension_id] [second_extension_id]"
    exit 1
    ;;
esac
