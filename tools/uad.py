#!/usr/bin/env python3
"""Entry point for the Universal AI Dev toolkit.

Runnable with a bare Python 3.9+ install, no dependencies:

    python tools/uad.py detect .
    python tools/uad.py select "optimise my Unreal project"
    python tools/uad.py validate --strict
    python tools/uad.py install --target claude-code --platforms godot web
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from uad.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
