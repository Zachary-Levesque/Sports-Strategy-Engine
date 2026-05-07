from __future__ import annotations

import json
import logging
from typing import Any


LOGGER_NAME = "sports_strategy_engine"


def configure_logging(level: str) -> logging.Logger:
    logger = logging.getLogger(LOGGER_NAME)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    logger.setLevel(level.upper())
    logger.propagate = False
    return logger


def get_logger() -> logging.Logger:
    return logging.getLogger(LOGGER_NAME)


def log_event(event: str, **fields: Any) -> str:
    payload = {"event": event, **fields}
    return json.dumps(payload, default=str, sort_keys=True)
