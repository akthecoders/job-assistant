#!/usr/bin/env bash
# AI Job Assistant — Unix launcher (macOS / Linux)
# Delegates all logic to start.py so this file stays tiny.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Locate a usable Python 3.11+ interpreter ─────────────────────────────────
find_python() {
  # Prefer explicit version commands first, then fall back to generic python3/python
  for cmd in python3.13 python3.12 python3.11 python3 python; do
    if command -v "$cmd" &>/dev/null; then
      ver=$("$cmd" -c "import sys; print(sys.version_info[:2])" 2>/dev/null || echo "(0, 0)")
      # Accept 3.11 and above
      if "$cmd" -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
        echo "$cmd"
        return 0
      fi
    fi
  done
  return 1
}

PYTHON=$(find_python 2>/dev/null) || true

if [ -z "$PYTHON" ]; then
  echo ""
  echo "  ERROR: Python 3.11+ is required but was not found."
  echo ""
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  macOS — install options:"
    echo "    brew install python@3.13"
    echo "    or download from https://python.org"
  else
    echo "  Linux — install options:"
    echo "    sudo apt install python3.11   # Debian/Ubuntu"
    echo "    sudo dnf install python3.11   # Fedora/RHEL"
    echo "    or download from https://python.org"
  fi
  echo ""
  exit 1
fi

exec "$PYTHON" "$SCRIPT_DIR/start.py" "$@"
