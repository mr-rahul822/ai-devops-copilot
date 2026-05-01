from datetime import datetime, timezone
from src.schemas import NormalizedMetric


def normalize(raw: dict) -> NormalizedMetric:
    """
    Converts a raw collector output dict into a NormalizedMetric.
    Validates required fields exist and fills in defaults for optional ones.
    Raises ValueError if required fields are missing.
    """
    required = ("user_id", "service_name", "cpu_percent")
    for field in required:
        if field not in raw:
            raise ValueError(f"Collector output missing required field: '{field}'")

    # ram_percent and disk_percent may be None when SSM is unavailable
    raw_ram = raw.get("ram_percent")
    raw_disk = raw.get("disk_percent")

    return NormalizedMetric(
        user_id=raw["user_id"],
        service_name=raw["service_name"],
        cpu_percent=round(float(raw["cpu_percent"]), 2),
        ram_percent=round(float(raw_ram), 2) if raw_ram is not None else None,
        disk_percent=round(float(raw_disk), 2) if raw_disk is not None else None,
        source=raw.get("source", "local"),
        region=raw.get("region", "local"),
        timestamp=raw.get("timestamp", datetime.now(timezone.utc)),
    )
