#!/usr/bin/env bash
# Convenience wrapper around `python tools/uad.py install`.
#
#   ./install.sh                          interactive
#   ./install.sh claude-code godot web    non-interactive
#
# Everything this does can be done directly with the CLI; see docs/installation.md.

set -euo pipefail

cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"
if ! command -v "$PYTHON" >/dev/null 2>&1; then
    PYTHON=python
fi
if ! command -v "$PYTHON" >/dev/null 2>&1; then
    echo "error: Python 3.9+ is required but was not found on PATH." >&2
    exit 1
fi

version=$("$PYTHON" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
echo "Using $PYTHON (Python $version)"

TARGET="${1:-}"
shift || true
PLATFORMS=("$@")

if [ -z "$TARGET" ]; then
    echo
    echo "Which AI coding client are you installing for?"
    echo "  1) claude-code     Claude Code (skills, agents, slash commands)"
    echo "  2) codex           OpenAI Codex"
    echo "  3) copilot         GitHub Copilot / VS Code"
    echo "  4) cursor          Cursor"
    echo "  5) generic         any Agent Skills client (you supply --dest)"
    printf 'Choice [1]: '
    read -r choice
    case "${choice:-1}" in
        1) TARGET=claude-code ;;
        2) TARGET=codex ;;
        3) TARGET=copilot ;;
        4) TARGET=cursor ;;
        5) TARGET=generic ;;
        *) echo "error: unrecognised choice" >&2; exit 1 ;;
    esac
fi

if [ ${#PLATFORMS[@]} -eq 0 ]; then
    echo
    echo "Which platforms do you work on? Core skills always install."
    echo "Available: unreal unity godot roblox minecraft web"
    printf 'Platforms (space separated, blank for all): '
    read -r -a PLATFORMS
fi

echo
"$PYTHON" tools/uad.py doctor

ARGS=(--target "$TARGET")
if [ ${#PLATFORMS[@]} -gt 0 ]; then
    ARGS+=(--platforms "${PLATFORMS[@]}")
fi

# Show exactly what will be written before writing it. This installs into your
# home directory by default, so it should never be a surprise.
echo
"$PYTHON" tools/uad.py install "${ARGS[@]}" --dry-run | tail -n 6

if [ -t 0 ]; then
    echo
    printf 'Proceed? [Y/n]: '
    read -r confirm
    case "${confirm:-y}" in
        [nN]*) echo "Cancelled. Nothing was written."; exit 0 ;;
    esac
fi

echo
"$PYTHON" tools/uad.py install "${ARGS[@]}"

echo
echo "Restart your AI client so it picks up the new skills."
