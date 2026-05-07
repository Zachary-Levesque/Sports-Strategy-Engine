from __future__ import annotations

import os
from pathlib import Path
import sys
import tempfile


ROOT = Path(__file__).resolve().parent
TEST_DB_PATH = Path(tempfile.gettempdir()) / "sports_strategy_engine_test.db"

if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

os.environ.setdefault("SPORTS_STRATEGY_DATABASE_URL", f"sqlite:///{TEST_DB_PATH}")
os.environ.setdefault("SPORTS_STRATEGY_LOG_LEVEL", "WARNING")

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
