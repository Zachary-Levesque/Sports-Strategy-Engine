from __future__ import annotations

import json
from typing import Any


def dumps(data: Any) -> str:
    return json.dumps(data, default=str)


def loads(data: str) -> Any:
    return json.loads(data)
