from datetime import datetime, timezone
from src.schemas import NormalizedMetric


def normalize(raw: dict) -> NormalizedMetric:
    """
    Converts a raw collector output dict into a NormalizedMetric.
    Validates required fields exist and fills in defaults for optional ones.
    Raises ValueError if required fields are missing.
    """
    required = ("user_id", "service_name", "cpu_percent", "ram_percent", "disk_percent")
    for field in required:
        if field not in raw:
            raise ValueError(f"Collector output missing required field: '{field}'")

    return NormalizedMetric(
        user_id=raw["user_id"],
        service_name=raw["service_name"],
        cpu_percent=round(float(raw["cpu_percent"]), 2),
        ram_percent=round(float(raw["ram_percent"]), 2),
        disk_percent=round(float(raw["disk_percent"]), 2),
        source=raw.get("source", "local"),
        region=raw.get("region", "local"),
        timestamp=raw.get("timestamp", datetime.now(timezone.utc)),
    )
