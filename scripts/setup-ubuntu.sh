#!/usr/bin/env bash
# Sets up a clean Ubuntu for developing o-tempora with Claude Code: system
# packages, Node, the repo's dependencies and the Playwright Chromium that
# `npm run a11y` and `npm run shot` need. Node comes from nvm. Idempotent; run from anywhere.
set -euo pipefail

NODE_MIN="26.0.0"
NODE_MAJOR="26"
NVM_VERSION="v0.40.3"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n==> %s\n' "$*"; }

version_gte() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]; }

log "System packages"
sudo apt-get update
sudo apt-get install -y git curl ca-certificates build-essential jq python3 ripgrep gh
# Optional per release; the modern-CLI hook (.claude/hooks) points Claude at these.
for pkg in fd-find bat eza; do
  sudo apt-get install -y "$pkg" || echo "warning: $pkg is not in apt on this release; install it manually"
done

log "Modern CLI names"
mkdir -p "$HOME/.local/bin"
command -v fd >/dev/null || { command -v fdfind >/dev/null && ln -sf "$(command -v fdfind)" "$HOME/.local/bin/fd"; } || true
command -v bat >/dev/null || { command -v batcat >/dev/null && ln -sf "$(command -v batcat)" "$HOME/.local/bin/bat"; } || true
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo "note: add \$HOME/.local/bin to PATH so fd and bat resolve" ;;
esac

log "Node >= $NODE_MIN (via nvm)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSo- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | PROFILE=/dev/null bash
fi
# nvm.sh reads unset variables, so it can't be sourced under `set -u`.
set +u
. "$NVM_DIR/nvm.sh"
nvm install "$NODE_MAJOR"
nvm alias default "$NODE_MAJOR"
set -u
version_gte "$(node -p 'process.versions.node')" "$NODE_MIN" \
  || { echo "error: installed node $(node -v) is older than $NODE_MIN" >&2; exit 1; }
if ! grep -qs 'NVM_DIR' "$HOME/.bashrc"; then
  printf '\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"\n' >> "$HOME/.bashrc"
fi

log "Repo dependencies (also installs the husky hooks)"
cd "$REPO_ROOT"
npm install

log "Playwright Chromium"
npx playwright install --with-deps chromium

log "Done"
cat <<'MSG'
Still manual: install Claude Code and log in (`claude`), then open /hooks once so
the project's PreToolUse hook is picked up.
Check the setup:
  npm run typecheck --workspace packages/web
  npm run test --workspace packages/web
MSG
