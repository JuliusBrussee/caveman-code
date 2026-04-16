import json
from typing import Any


def parse_config(json_string: str) -> dict[str, str]:
    """Parse a JSON config string into a flat key-value dict.

    Supports nested objects by flattening keys with dot notation.
    Example: {"db": {"host": "localhost"}} -> {"db.host": "localhost"}
    """
    raw = json.loads(json_string)
    result: dict[str, str] = {}

    for key, value in raw.items():
        # Bug: does not handle nested dicts — just converts to string
        result[key] = str(value)

    return result


def get_config_value(config: dict[str, str], dotted_key: str) -> str | None:
    """Look up a value by its dotted key path."""
    return config.get(dotted_key)
