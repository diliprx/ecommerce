# """
# app/utils/logger.py
# ────────────────────
# Structured JSON logging via structlog.
# Security: never log passwords, tokens, card data, or PII beyond email.
# """
# import logging
# import sys

# import structlog

# from app.core.config import get_settings

# settings = get_settings()


# def setup_logging() -> None:
#     log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

#     structlog.configure(
#         processors=[
#             structlog.contextvars.merge_contextvars,
#             structlog.stdlib.add_log_level,
#             structlog.stdlib.add_logger_name,
#             structlog.processors.TimeStamper(fmt="iso"),
#             structlog.processors.StackInfoRenderer(),
#             structlog.processors.format_exc_info,
#             # JSON in production, pretty in dev
#             structlog.processors.JSONRenderer()
#             if settings.APP_ENV == "production"
#             else structlog.dev.ConsoleRenderer(),
#         ],
#         wrapper_class=structlog.make_filtering_bound_logger(log_level),
#         context_class=dict,
#         logger_factory=structlog.PrintLoggerFactory(),
#     )

#     # Silence noisy libs
#     logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
#     logging.getLogger("sqlalchemy.engine").setLevel(
#         logging.DEBUG if settings.APP_DEBUG else logging.WARNING
#     )


# def get_logger(name: str):
#     return structlog.get_logger(name)

"""
app/utils/logger.py
────────────────────
Structured JSON logging via structlog.
Security: never log passwords, tokens, card data, or PII beyond email.
"""

import logging
import sys
import structlog

from app.core.config import get_settings

settings = get_settings()


def setup_logging() -> None:
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    # ✅ Standard logging config (REQUIRED)
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    # ✅ Structlog configuration
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,      # adds "level"
            structlog.stdlib.add_logger_name,    # adds "logger"
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,

            # ✅ JSON in production, pretty logs in dev
            structlog.processors.JSONRenderer()
            if settings.APP_ENV == "production"
            else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,

        # ✅ FIX: use stdlib logger instead of PrintLogger
        logger_factory=structlog.stdlib.LoggerFactory(),
    )

    # ✅ Reduce noise (important for clean logs)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)

    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.DEBUG if settings.APP_DEBUG else logging.WARNING
    )


def get_logger(name: str):
    return structlog.get_logger(name)