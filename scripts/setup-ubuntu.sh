#!/usr/bin/env bash
# Sets up a clean Ubuntu for developing o-tempora with Claude Code: system
# packages, Node, the repo's dependencies and the Playwright Chromium that
# `npm run a11y` and `npm run shot` need. Idempotent; run from anywhere.
set -euo pipefail

NODE_MIN="22.21.0"
NODE_MAJOR="22"
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

log "Node >= $NODE_MIN"
if command -v node >/dev/null && version_gte "$(node -p 'process.versions.node')" "$NODE_MIN"; then
  echo "node $(node -v) is fine"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
  version_gte "$(node -p 'process.versions.node')" "$NODE_MIN" \
    || { echo "error: installed node $(node -v) is older than $NODE_MIN" >&2; exit 1; }
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
