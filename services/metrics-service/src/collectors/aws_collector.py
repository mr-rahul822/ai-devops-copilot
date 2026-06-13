"""
src/collectors/aws_collector.py — AWS EC2 metrics via CloudWatch.

Collects:
  - CPU utilisation  → standard AWS/EC2 namespace
  - RAM (mem_used_percent) → CloudWatch Agent custom namespace "DevOpsCopilot"
  - Disk (disk_used_percent) → CloudWatch Agent custom namespace "DevOpsCopilot"
  - Network I/O      → CloudWatch Agent custom namespace "DevOpsCopilot"

If the CloudWatch Agent is NOT installed on the EC2 instance, RAM/Disk/Network
metrics will be returned as 0.0 and a warning will be logged.
"""

import logging
from datetime import datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from src.config import settings

logger = logging.getLogger(__name__)

# Custom namespace configured in the CloudWatch Agent on EC2
CW_AGENT_NAMESPACE = "DevOpsCopilot"


def get_boto_session():
    """Create a Boto3 session using temporary STS credentials from config."""
    return boto3.Session(
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        aws_session_token=settings.aws_session_token,
        region_name=settings.aws_default_region,
    )


# ---------------------------------------------------------------------------
# Helpers — fetch individual metrics from CloudWatch
# ---------------------------------------------------------------------------

def _get_metric(
    cw_client,
    namespace: str,
    metric_name: str,
    dimensions: list[dict],
    stat: str = "Average",
    period: int = 300,
    minutes: int = 10,
) -> float | None:
    """
    Fetch the latest data-point for a single CloudWatch metric.
    Returns the value as a float, or None if no data-points are found.
    """
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(minutes=minutes)

    try:
        resp = cw_client.get_metric_statistics(
            Namespace=namespace,
            MetricName=metric_name,
            Dimensions=dimensions,
            StartTime=start_time,
            EndTime=end_time,
            Period=period,
            Statistics=[stat],
        )
    except ClientError as exc:
        logger.warning(
            "CloudWatch query failed for %s/%s: %s",
            namespace, metric_name, exc,
        )
        return None

    datapoints = resp.get("Datapoints", [])
    if not datapoints:
        return None

    # Return the most recent data-point
    datapoints.sort(key=lambda dp: dp["Timestamp"], reverse=True)
    return float(datapoints[0][stat])


def _get_instance_name(instance: dict) -> str:
    """Extract the Name tag from an EC2 instance dict, or fall back to instance ID."""
    for tag in instance.get("Tags", []):
        if tag["Key"] == "Name":
            return tag["Value"]
    return instance["InstanceId"]


# ---------------------------------------------------------------------------
# CloudWatch Agent metrics (RAM, Disk, Network)
# ---------------------------------------------------------------------------

def _get_cloudwatch_agent_metrics(
    cw_client, instance_id: str
) -> dict:
    """
    Fetch OS-level metrics from the CloudWatch Agent custom namespace.

    Expected metrics (configured in the agent JSON):
      - mem_used_percent
      - disk_used_percent  (path="/", fstype and device vary per instance)
      - net_bytes_sent     (interface="eth0")
      - net_bytes_recv     (interface="eth0")

    Returns a dict with keys: ram_percent, disk_percent,
    net_bytes_sent, net_bytes_recv.  Values are 0.0 when unavailable.
    """
    instance_dim = [{"Name": "InstanceId", "Value": instance_id}]

    # --- RAM (simple: only InstanceId dimension) ---
    ram = _get_metric(
        cw_client,
        namespace=CW_AGENT_NAMESPACE,
        metric_name="mem_used_percent",
        dimensions=instance_dim,
    )

    # --- Disk (dynamic: discover exact dimensions via list_metrics) ---
    disk = None
    try:
        disk_metrics = cw_client.list_metrics(
            Namespace=CW_AGENT_NAMESPACE,
            MetricName="disk_used_percent",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
        ).get("Metrics", [])

        # Find the metric for path="/" (root filesystem)
        for metric in disk_metrics:
            dims = metric.get("Dimensions", [])
            dim_dict = {d["Name"]: d["Value"] for d in dims}
            if dim_dict.get("path") == "/":
                # Use the exact dimensions CloudWatch Agent published
                disk = _get_metric(
                    cw_client,
                    namespace=CW_AGENT_NAMESPACE,
                    metric_name="disk_used_percent",
                    dimensions=dims,
                )
                if disk is not None:
                    break
    except Exception as exc:
        logger.warning("Failed to discover disk dimensions for %s: %s", instance_id, exc)

    # --- Network ---
    net_sent = None
    net_recv = None
    try:
        net_metrics = cw_client.list_metrics(
            Namespace=CW_AGENT_NAMESPACE,
            MetricName="net_bytes_sent",
            Dimensions=[{"Name": "InstanceId", "Value": instance_id}],
        ).get("Metrics", [])

        if net_metrics:
            net_dims = net_metrics[0].get("Dimensions", [])
            net_sent = _get_metric(
                cw_client,
                namespace=CW_AGENT_NAMESPACE,
                metric_name="net_bytes_sent",
                dimensions=net_dims,
                stat="Sum",
            )
            # Use same dimensions (just different metric name) for recv
            net_recv = _get_metric(
                cw_client,
                namespace=CW_AGENT_NAMESPACE,
                metric_name="net_bytes_recv",
                dimensions=net_dims,
                stat="Sum",
            )
    except Exception as exc:
        logger.warning("Failed to discover network dimensions for %s: %s", instance_id, exc)

    # Log warnings if CloudWatch Agent metrics are missing
    if ram is None and disk is None:
        logger.warning(
            "CloudWatch Agent metrics NOT found for %s in namespace '%s'. "
            "Ensure the CloudWatch Agent is installed and configured on this "
            "EC2 instance. RAM and Disk will report 0.0.",
            instance_id, CW_AGENT_NAMESPACE,
        )

    return {
        "ram_percent": round(ram, 2) if ram is not None else 0.0,
        "disk_percent": round(disk, 2) if disk is not None else 0.0,
        "net_bytes_sent": round(net_sent, 0) if net_sent is not None else 0.0,
        "net_bytes_recv": round(net_recv, 0) if net_recv is not None else 0.0,
    }


# ---------------------------------------------------------------------------
# Main collector
# ---------------------------------------------------------------------------

def collect() -> list[dict]:
    """
    Collects metrics from all running AWS EC2 instances.

    - CPU utilisation  → AWS/EC2 standard namespace (always available)
    - RAM, Disk, Network → DevOpsCopilot custom namespace (CloudWatch Agent)

    Returns a list of raw dicts consumed by the normalizer.
    """
    if not settings.aws_access_key_id or not settings.aws_secret_access_key:
        logger.warning("AWS credentials not available — skipping EC2 collection. Connect via Cloud Configuration to start.")
        return []

    try:
        session = get_boto_session()
        ec2 = session.client("ec2")
        cw = session.client("cloudwatch")
        region = settings.aws_default_region

        # 1. Discover running instances
        response = ec2.describe_instances(
            Filters=[{"Name": "instance-state-name", "Values": ["running"]}]
        )

        instances = []
        for reservation in response.get("Reservations", []):
            for inst in reservation.get("Instances", []):
                instances.append(inst)

        if not instances:
            logger.info("No running EC2 instances found in %s.", region)
            return []

        logger.info("Found %d running EC2 instance(s) in %s.", len(instances), region)

        # 2. Collect metrics for each instance
        results = []

        for inst in instances:
            instance_id = inst["InstanceId"]
            instance_type = inst.get("InstanceType", "unknown")
            service_name = _get_instance_name(inst)
            instance_dim = [{"Name": "InstanceId", "Value": instance_id}]

            # --- CPU from standard AWS/EC2 namespace ---
            cpu = _get_metric(
                cw,
                namespace="AWS/EC2",
                metric_name="CPUUtilization",
                dimensions=instance_dim,
            )
            cpu_percent = round(cpu, 2) if cpu is not None else 0.0

            # --- RAM, Disk, Network from CloudWatch Agent ---
            agent_metrics = _get_cloudwatch_agent_metrics(cw, instance_id)

            results.append({
                "user_id": settings.default_user_id,
                "service_name": service_name or f"aws-ec2-{instance_id}",
                "cpu_percent": cpu_percent,
                "ram_percent": agent_metrics["ram_percent"],
                "disk_percent": agent_metrics["disk_percent"],
                "source": "aws",
                "region": region,
                "instance_id": instance_id,
                "instance_type": instance_type,
                "timestamp": datetime.utcnow(),
            })

            logger.info(
                "Collected [%s/%s]: cpu=%.1f%% ram=%.1f%% disk=%.1f%%",
                service_name, instance_id,
                cpu_percent,
                agent_metrics["ram_percent"],
                agent_metrics["disk_percent"],
            )

        return results

    except NoCredentialsError:
        logger.error("AWS credentials are invalid or expired.")
        return []
    except Exception as exc:
        logger.error("Failed to collect AWS metrics: %s", exc, exc_info=True)
        return []
