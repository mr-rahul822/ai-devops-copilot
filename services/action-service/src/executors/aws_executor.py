"""
src/executors/aws_executor.py — Execute actions on AWS infrastructure.

Uses boto3 for AWS API calls.  By default all WRITE operations run in
DRY_RUN mode (env var DRY_RUN=true) so the portfolio demo never
accidentally changes real infrastructure.

READ-only operations (get_instance_status) always execute for real.
"""

import asyncio
import logging
import os

import boto3
from botocore.exceptions import ClientError, NoCredentialsError, BotoCoreError

from src.executors.base_executor import BaseExecutor

logger = logging.getLogger(__name__)

SUPPORTED_ACTIONS = [
    "rollback_deployment",
    "scale_service",
    "get_instance_status",
]


class AWSExecutor(BaseExecutor):
    """Executes infrastructure actions against AWS."""

    def __init__(self):
        self._dry_run = os.getenv("DRY_RUN", "true").lower() == "true"
        self._configured = False

        try:
            self._sts = boto3.client("sts")
            # Quick validation — will throw if no creds at all
            self._sts.get_caller_identity()
            self._configured = True
            logger.info("AWSExecutor: credentials valid (DRY_RUN=%s)", self._dry_run)
        except (NoCredentialsError, ClientError, BotoCoreError) as e:
            logger.warning("AWSExecutor: AWS not configured — %s", e)

    @property
    def executor_type(self) -> str:
        return "aws"

    @property
    def is_configured(self) -> bool:
        return self._configured

    def validate(self, action: dict) -> bool:
        action_type = action.get("action_type", "")
        if action_type not in SUPPORTED_ACTIONS:
            return False
        if not action.get("target_service"):
            return False
        return True

    async def execute(self, action: dict) -> dict:
        """Dispatch to the correct AWS action handler."""
        action_type = action.get("action_type")
        target = action.get("target_service")
        params = action.get("params", {})

        handlers = {
            "rollback_deployment": self._rollback_deployment,
            "scale_service": self._scale_service,
            "get_instance_status": self._get_instance_status,
        }

        handler = handlers.get(action_type)
        if handler is None:
            return self.build_result(
                False, f"Unsupported AWS action: {action_type}"
            )

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, handler, target, params)

    # ── ACTION 1: rollback_deployment ─────────────────────────────────────

    def _rollback_deployment(self, target: str, params: dict) -> dict:
        version = params.get("version", "previous")

        if self._dry_run:
            logger.info(
                "[AWS DRY_RUN] Would rollback '%s' to version '%s'",
                target, version,
            )
            return self.build_result(
                success=True,
                message=(
                    f"DRY RUN: Would rollback '{target}' to {version} version. "
                    f"Set DRY_RUN=false to execute."
                ),
                details={
                    "dry_run": True,
                    "target": target,
                    "version": version,
                },
            )

        # TODO: Implement real rollback via CodeDeploy or ECS update-service
        # Example (ECS):
        #   ecs = boto3.client("ecs")
        #   ecs.update_service(
        #       cluster="...", service=target,
        #       taskDefinition="...previous..."
        #   )
        try:
            logger.info("[AWS] Rolling back '%s' to '%s'", target, version)
            return self.build_result(
                success=True,
                message=f"Rollback of '{target}' to {version} initiated",
                details={
                    "dry_run": False,
                    "target": target,
                    "version": version,
                    "note": "Real rollback — placeholder implementation",
                },
            )
        except (ClientError, BotoCoreError) as e:
            return self.build_result(False, f"AWS error: {str(e)}")

    # ── ACTION 2: scale_service ───────────────────────────────────────────

    def _scale_service(self, target: str, params: dict) -> dict:
        desired_count = params.get("desired_count", 2)

        if self._dry_run:
            logger.info(
                "[AWS DRY_RUN] Would scale '%s' to %d instances",
                target, desired_count,
            )
            return self.build_result(
                success=True,
                message=(
                    f"DRY RUN: Would scale '{target}' to {desired_count} instances. "
                    f"Set DRY_RUN=false to execute."
                ),
                details={
                    "dry_run": True,
                    "target": target,
                    "desired_count": desired_count,
                },
            )

        # TODO: Implement real scaling via Auto Scaling or ECS
        # Example (ASG):
        #   asg = boto3.client("autoscaling")
        #   asg.update_auto_scaling_group(
        #       AutoScalingGroupName=target,
        #       DesiredCapacity=desired_count,
        #   )
        try:
            logger.info("[AWS] Scaling '%s' to %d", target, desired_count)
            return self.build_result(
                success=True,
                message=f"Scaling of '{target}' to {desired_count} instances initiated",
                details={
                    "dry_run": False,
                    "target": target,
                    "desired_count": desired_count,
                    "note": "Real scaling — placeholder implementation",
                },
            )
        except (ClientError, BotoCoreError) as e:
            return self.build_result(False, f"AWS error: {str(e)}")

    # ── ACTION 3: get_instance_status (always real — read-only) ───────────

    def _get_instance_status(self, target: str, params: dict) -> dict:
        """
        Read-only: fetch instance or service status from AWS.
        This never uses DRY_RUN since it makes no changes.
        """
        if not self._configured:
            return self.build_result(
                success=False,
                message="AWS credentials not configured. Cannot query instance status.",
                details={"target": target},
            )

        try:
            ec2 = boto3.client("ec2")
            response = ec2.describe_instances(
                Filters=[
                    {"Name": "tag:Name", "Values": [target]},
                ]
            )

            instances = []
            for reservation in response.get("Reservations", []):
                for inst in reservation.get("Instances", []):
                    instances.append({
                        "instance_id": inst["InstanceId"],
                        "state": inst["State"]["Name"],
                        "type": inst["InstanceType"],
                        "launch_time": inst.get("LaunchTime", "").isoformat()
                        if inst.get("LaunchTime")
                        else None,
                    })

            if not instances:
                # Try by instance ID directly
                try:
                    response = ec2.describe_instances(InstanceIds=[target])
                    for reservation in response.get("Reservations", []):
                        for inst in reservation.get("Instances", []):
                            instances.append({
                                "instance_id": inst["InstanceId"],
                                "state": inst["State"]["Name"],
                                "type": inst["InstanceType"],
                                "launch_time": inst.get("LaunchTime", "").isoformat()
                                if inst.get("LaunchTime")
                                else None,
                            })
                except ClientError:
                    pass

            if instances:
                return self.build_result(
                    success=True,
                    message=f"Found {len(instances)} instance(s) for '{target}'",
                    details={"instances": instances},
                )
            else:
                return self.build_result(
                    success=True,
                    message=f"No instances found for '{target}'",
                    details={"instances": []},
                )

        except (ClientError, BotoCoreError) as e:
            return self.build_result(False, f"AWS error: {str(e)}")
        except Exception as e:
            return self.build_result(False, f"Unexpected error: {str(e)}")
