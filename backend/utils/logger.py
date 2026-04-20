"""
utils/logger.py
===============
Centralised logging factory.
All modules call get_logger(__name__) instead of configuring their own handlers.
"""

import logging
import sys

_CONFIGURED = False


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logger once. Safe to call multiple times."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        fmt="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
        datefmt="%H:%M:%S",
    ))
    root = logging.getLogger()
    root.setLevel(level)
    if not root.handlers:
        root.addHandler(handler)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a named logger, ensuring root logging is configured."""
    setup_logging()
    return logging.getLogger(name)
