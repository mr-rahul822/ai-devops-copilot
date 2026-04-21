import psutil
from datetime import datetime
from src.config import settings


def collect() -> dict:
    """
    Collects CPU, RAM, and disk metrics from the local machine using psutil.
    Returns a raw dict that the normalizer will convert to NormalizedMetric.
    The 1-second interval for cpu_percent gives a more accurate reading.
    """
    cpu = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory().percent
    disk = psutil.disk_usage("/").percent

    return {
        "user_id": settings.default_user_id,
        "service_name": "local-machine",
        "cpu_percent": cpu,
        "ram_percent": ram,
        "disk_percent": disk,
        "source": "local",
        "region": "local",
        "timestamp": datetime.utcnow(),
    }
