"""Centralized logging configuration for the DCA bot."""

import logging
import os
from pathlib import Path
from logging.handlers import RotatingFileHandler


def get_logger(name: str) -> logging.Logger:
    """
    Return a logger with both file and console handlers.
    Logs are written to logs/dca_bot.log with rotation.
    """
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger  # Already configured

    logger.setLevel(logging.DEBUG)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler (INFO+)
    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(formatter)
    logger.addHandler(console)

    # File handler with rotation (DEBUG+)
    log_dir = Path(__file__).parents[2] / "logs"
    log_dir.mkdir(exist_ok=True)
    file_handler = RotatingFileHandler(
        log_dir / "dca_bot.log",
        maxBytes=5 * 1024 * 1024,  # 5 MB
        backupCount=5,
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    return logger
