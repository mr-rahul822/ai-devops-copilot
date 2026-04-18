"""
AWS CloudWatch Collector — Phase 3 (not yet implemented).

This module will pull CPU/RAM/disk metrics from AWS CloudWatch for
EC2 instances, ECS tasks and RDS clusters. The class structure is
stubbed here so the scheduler and normalizer pipeline remain intact.

Prerequisites (implement later):
  - boto3 configured with IAM role or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  - CloudWatch agent publishing custom RAM/disk metrics to the namespace
    "CWAgent" (default agent configuration)
"""

from datetime import datetime, timezone


class AWSCloudWatchCollector:
    """Collects metrics from AWS CloudWatch for a given EC2 instance."""

    def __init__(self, region: str, instance_id: str):
        self.region = region
        self.instance_id = instance_id
        # boto3 client will be initialised here in Phase 3
        # import boto3
        # self.client = boto3.client("cloudwatch", region_name=region)

    def collect(self) -> dict:
        """
        TODO (Phase 3): Query CloudWatch for the last data point of:
          - AWS/EC2 CPUUtilization
          - CWAgent mem_used_percent
          - CWAgent disk_used_percent
        and return a raw dict compatible with the normalizer.
        """
        raise NotImplementedError(
            "AWS CloudWatch collector is planned for Phase 3. "
            "Use local_collector for development."
        )

    def _get_metric(self, namespace: str, metric_name: str, dimensions: list) -> float:
        """TODO (Phase 3): Fetch a single CloudWatch metric data point."""
        raise NotImplementedError
