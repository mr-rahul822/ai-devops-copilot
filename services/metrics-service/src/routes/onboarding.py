"""
src/routes/onboarding.py — Cloud onboarding wizard endpoints (ARN-based).

Uses IAM Role ARN + STS AssumeRole instead of permanent access keys.
No permanent credentials are stored — only the role_arn and external_id.

Endpoints:
  1. GET  /cloud/trust-policy — returns Trust Policy JSON + ExternalId for the user
  2. POST /cloud/connect     — validate ARN → AssumeRole → discover → save
  3. GET  /cloud/status       — current connection status
  4. DELETE /cloud/disconnect — remove credentials and stop monitoring
  5. GET  /cloud/instances    — live EC2 instance list with latest metrics
"""

import re
import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

import boto3
import httpx
from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select, delete, text, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db, Base
from src.models import Metric

# ── ORM model for cloud_credentials ──────────────────────────────────────────
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class CloudCredential(Base):
    """Stores cloud provider connection info per user (ARN-based, no secrets)."""

    __tablename__ = "cloud_credentials"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    role_arn: Mapped[str] = mapped_column(Text, nullable=False)
    external_id: Mapped[str] = mapped_column(String(100), nullable=False)
    account_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="connected")
    instances_found: Mapped[int | None] = mapped_column(Integer, default=0)
    connected_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    last_sync_at: Mapped[datetime | None] = mapped_column(nullable=True)
    temp_credentials_expire_at: Mapped[datetime | None] = mapped_column(nullable=True)


router = APIRouter(prefix="/cloud", tags=["cloud-onboarding"])
logger = logging.getLogger(__name__)

# Regex for validating IAM Role ARN format
ARN_PATTERN = re.compile(r"^arn:aws:iam::\d{12}:role/.+$")


# ── Auth dependency (same pattern as metrics.py) ─────────────────────────────

async def _verify_token(authorization: str) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
    
    token = authorization.split(" ", 1)[1]
    import jwt
    try:
        decoded = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    user_id = decoded.get("userId")
    email = decoded.get("email")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    return {
        "user": {
            "id": user_id,
            "email": email
        }
    }


async def require_auth(authorization: Optional[str] = Header(default=None)) -> dict:
    return await _verify_token(authorization)


# ── Helpers ──────────────────────────────────────────────────────────────────

FRIENDLY_ERRORS = {
    "InvalidClientTokenId": "Invalid Access Key. Please double-check you copied the full key correctly.",
    "SignatureDoesNotMatch": "Invalid Secret Key. Please double-check you copied the full key correctly.",
    "AccessDenied": "Your AWS key doesn't have the required permission. In AWS IAM, attach the ReadOnlyAccess policy to your user.",
    "AuthFailure": "AWS authentication failed. Please verify both your Access Key and Secret Key.",
    "UnauthorizedAccess": "Your AWS key is not authorized for this operation.",
}


def _friendly_error(exc: ClientError, fallback: str = "") -> str:
    """Convert a boto3 ClientError into a human-readable message."""
    code = exc.response.get("Error", {}).get("Code", "")
    return FRIENDLY_ERRORS.get(code, fallback or f"AWS error: {code}")


def _assume_role(role_arn: str, external_id: str, region: str) -> boto3.Session:
    """
    Assume an IAM role via STS and return a boto3 session with temporary credentials.
    
    Uses the PLATFORM's permanent IAM credentials (from env vars) to call STS.
    Explicitly clears any stale AWS_SESSION_TOKEN to prevent boto3's credential
    chain from mixing permanent keys with an expired session token.
    """
    import os
    import time

    try:
        target_account_id = role_arn.split(":")[4]
    except (IndexError, AttributeError):
        target_account_id = ""

    # Read the PLATFORM's permanent IAM keys from env vars.
    # These are the long-lived credentials of the platform's own IAM user,
    # used solely to call sts:AssumeRole on the customer's role.
    aws_key = os.environ.get("AWS_ACCESS_KEY_ID", "").strip() or None
    aws_secret = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip() or None

    if not aws_key or not aws_secret:
        logger.error(
            "Platform AWS credentials not set. "
            "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in the environment."
        )
        raise HTTPException(
            status_code=500,
            detail="Platform AWS credentials are not configured. Please contact the administrator."
        )

    # CRITICAL: Clear any stale session token from the environment.
    # boto3's credential chain checks AWS_SESSION_TOKEN even when explicit
    # access_key/secret_key are provided. If a previous STS call left a
    # session token in os.environ, boto3 will try to use it with the permanent
    # keys, causing InvalidClientTokenId errors intermittently.
    saved_session_token = os.environ.pop("AWS_SESSION_TOKEN", None)

    try:
        sts = boto3.client(
            "sts",
            aws_access_key_id=aws_key,
            aws_secret_access_key=aws_secret,
            region_name=region,
        )

        assume_params: dict = {
            "RoleArn": role_arn,
            "RoleSessionName": "DevOpsCopilot-Session",
            "DurationSeconds": 3600,
        }

        if external_id:
            assume_params["ExternalId"] = external_id

        logger.info(
            "STS AssumeRole attempt | role=%s | region=%s | has_external_id=%s | caller_key=%s...%s",
            role_arn, region, bool(external_id),
            aws_key[:4] if aws_key else "N/A",
            aws_key[-4:] if aws_key else "N/A",
        )

        # Retry up to 2 times for transient STS errors
        last_exc = None
        for attempt in range(3):
            try:
                assumed = sts.assume_role(**assume_params)
                break  # Success
            except ClientError as exc:
                code = exc.response.get("Error", {}).get("Code", "")
                msg = exc.response.get("Error", {}).get("Message", "")
                last_exc = exc

                logger.warning(
                    "STS AssumeRole attempt %d/%d FAILED | code=%s | message=%s | role_arn=%s",
                    attempt + 1, 3, code, msg, role_arn
                )

                # Only retry on transient errors, not permanent auth failures
                if code in ("AccessDenied", "MalformedPolicyDocument"):
                    break  # Don't retry — these are configuration errors
                if code in ("InvalidClientTokenId", "SignatureDoesNotMatch"):
                    # Transient — could be credential propagation delay
                    if attempt < 2:
                        time.sleep(1)
                        # Recreate STS client to force fresh credential resolution
                        sts = boto3.client(
                            "sts",
                            aws_access_key_id=aws_key,
                            aws_secret_access_key=aws_secret,
                            region_name=region,
                        )
                        continue
                break  # Unknown error — don't retry
        else:
            # All retries exhausted — raise last exception
            if last_exc:
                raise last_exc

        # Handle the exception from the loop if we broke out due to error
        if last_exc and 'assumed' not in dir():
            exc = last_exc
            code = exc.response.get("Error", {}).get("Code", "")
            msg = exc.response.get("Error", {}).get("Message", "")

            if code == "AccessDenied":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Could not assume your IAM Role. Please verify: "
                        f"1) The Trust Policy includes arn:aws:iam::{settings.platform_account_id}:root, "
                        "2) The ExternalId in the Trust Policy matches exactly, "
                        "3) The Role ARN is correct."
                    )
                )
            if code == "MalformedPolicyDocument":
                raise HTTPException(
                    status_code=400,
                    detail="The IAM Role's Trust Policy is malformed. Please copy the exact JSON from Step 1."
                )
            raise HTTPException(status_code=400, detail=f"STS AssumeRole failed: {code} — {msg}")

    except HTTPException:
        raise
    except EndpointConnectionError:
        raise HTTPException(status_code=400, detail="Could not reach AWS. Please check your internet connection.")
    except Exception as exc:
        logger.error("STS AssumeRole unexpected error: %s", exc, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Could not assume role: {str(exc)}")
    finally:
        # Restore session token if it was set before (for other services)
        if saved_session_token:
            os.environ["AWS_SESSION_TOKEN"] = saved_session_token

    creds = assumed["Credentials"]
    logger.info(
        "STS AssumeRole SUCCESS | role=%s | account=%s | expires=%s",
        role_arn, target_account_id, creds.get("Expiration", "N/A")
    )
    return boto3.Session(
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretAccessKey"],
        aws_session_token=creds["SessionToken"],
        region_name=region,
    )


CW_AGENT_CONFIG = json.dumps({
    "metrics": {
        "namespace": "DevOpsCopilot",
        "append_dimensions": {"InstanceId": "${aws:InstanceId}"},
        "metrics_collected": {
            "cpu": {
                "measurement": ["cpu_usage_user"],
                "metrics_collection_interval": 60,
                "totalcpu": True,
            },
            "mem": {
                "measurement": ["mem_used_percent"],
                "metrics_collection_interval": 60,
            },
            "disk": {
                "measurement": ["disk_used_percent"],
                "resources": ["/"],
                "metrics_collection_interval": 60,
            },
        },
    }
})


def _resolve_user_id(auth_data: dict) -> uuid.UUID:
    """Extract user UUID from auth payload."""
    user_data = auth_data.get("user", auth_data)
    user_id_str = user_data.get("id") or user_data.get("userId") or user_data.get("user_id", settings.default_user_id)
    try:
        return uuid.UUID(str(user_id_str))
    except ValueError:
        return uuid.UUID(settings.default_user_id)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cloud/trust-policy
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/trust-policy")
async def get_trust_policy(_auth: dict = Depends(require_auth)):
    """
    Returns the Trust Policy JSON the user must paste into their AWS IAM Role.
    The ExternalId is unique per user — prevents confused deputy attacks.
    """
    user_id = _resolve_user_id(_auth)
    external_id = f"dcp-{user_id}"

    trust_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "AWS": f"arn:aws:iam::{settings.platform_account_id}:root"
                },
                "Action": "sts:AssumeRole",
                "Condition": {
                    "StringEquals": {
                        "sts:ExternalId": external_id
                    }
                }
            }
        ]
    }

    return {
        "trust_policy": trust_policy,
        "external_id": external_id,
        "platform_account_id": settings.platform_account_id,
        "required_permissions": [
            {
                "policy_name": "CloudWatchAgentServerPolicy",
                "arn": "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
                "required": True,
                "description": "Allows collecting CPU, RAM, Disk metrics from EC2",
            },
            {
                "policy_name": "AmazonEC2ReadOnlyAccess",
                "arn": "arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess",
                "required": True,
                "description": "Allows discovering your EC2 instances",
            },
            {
                "policy_name": "AmazonSSMFullAccess",
                "arn": "arn:aws:iam::aws:policy/AmazonSSMFullAccess",
                "required": False,
                "description": "Allows auto-installing CloudWatch Agent on EC2 instances",
            },
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# POST /cloud/connect
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/connect")
async def connect_cloud(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """
    Full automated cloud onboarding (ARN-based):
      A. Validate role_arn format
      B. Generate ExternalId for this user
      C. AssumeRole via STS (validates trust policy + credentials)
      D. Verify required permissions
      E. Get account ID
      F. Discover EC2 instances
      G. Check CloudWatch Agent status
      H. Auto-install agent via SSM (if permission selected)
      I. Save role_arn + external_id to database (no secrets stored)
      J. Update runtime config for scheduler
    """
    role_arn = (body.get("role_arn") or "").strip()
    region = (body.get("region") or "us-east-1").strip()
    provider = (body.get("provider") or "aws").lower()
    selected_permissions = body.get("selected_permissions") or []

    user_id = _resolve_user_id(_auth)
    progress = []

    # ── STEP A: Validate role_arn format ─────────────────────────────────
    if not role_arn:
        raise HTTPException(status_code=400, detail="Please enter your IAM Role ARN.")
    if not ARN_PATTERN.match(role_arn):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid Role ARN format. "
                "It should look like: arn:aws:iam::123456789012:role/YourRoleName"
            ),
        )
    progress.append({"step": "validate_arn", "status": "success", "message": "Role ARN format is valid."})

    # ── STEP B: Generate ExternalId ──────────────────────────────────────
    external_id = f"dcp-{user_id}"
    progress.append({"step": "generate_external_id", "status": "success", "message": "ExternalId verified."})

    # ── STEP C: AssumeRole via STS ───────────────────────────────────────
    try:
        assumed_session = _assume_role(role_arn, external_id, region)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not assume role: {str(exc)}")

    progress.append({"step": "assume_role", "status": "success", "message": "Successfully assumed IAM Role via STS."})

    # ── STEP D: Verify required permissions ──────────────────────────────
    ec2 = assumed_session.client("ec2", region_name=region)
    cw = assumed_session.client("cloudwatch", region_name=region)

    perm_checks = [
        ("ec2:DescribeInstances", lambda: ec2.describe_instances(MaxResults=5)),
        ("cloudwatch:ListMetrics", lambda: cw.list_metrics(Namespace="AWS/EC2", MaxRecords=1)),
    ]

    # Optionally verify SSM permission
    if "AmazonSSMFullAccess" in selected_permissions:
        ssm_check = assumed_session.client("ssm", region_name=region)
        perm_checks.append(
            ("ssm:DescribeInstanceInformation", lambda: ssm_check.describe_instance_information(MaxResults=1))
        )

    for perm_name, check_fn in perm_checks:
        try:
            check_fn()
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("AccessDenied", "UnauthorizedAccess", "AccessDeniedException"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Your IAM Role is missing permission: {perm_name}. "
                           f"Please attach the required AWS managed policies to your Role.",
                )
            raise HTTPException(status_code=400, detail=_friendly_error(exc))
        except Exception:
            pass  # non-auth errors are OK at this stage

    progress.append({"step": "check_permissions", "status": "success", "message": "All required permissions verified."})

    # ── STEP E: Get account ID ───────────────────────────────────────────
    account_id = "unknown"
    try:
        sts_assumed = assumed_session.client("sts")
        identity = sts_assumed.get_caller_identity()
        account_id = identity.get("Account", "unknown")
    except Exception as exc:
        logger.warning("Could not get account ID: %s", exc)

    # ── STEP F: Discover EC2 instances ───────────────────────────────────
    instances_info = []
    try:
        resp = ec2.describe_instances(
            Filters=[{"Name": "instance-state-name", "Values": ["running"]}]
        )
        for reservation in resp.get("Reservations", []):
            for inst in reservation.get("Instances", []):
                name = ""
                for tag in inst.get("Tags", []):
                    if tag["Key"] == "Name":
                        name = tag["Value"]
                        break
                instances_info.append({
                    "instance_id": inst["InstanceId"],
                    "name": name or inst["InstanceId"],
                    "type": inst.get("InstanceType", "unknown"),
                    "state": inst.get("State", {}).get("Name", "unknown"),
                    "ip": inst.get("PublicIpAddress") or inst.get("PrivateIpAddress", "N/A"),
                    "cloudwatch_agent": False,
                    "agent_install_note": None,
                })
    except ClientError as exc:
        raise HTTPException(status_code=400, detail=_friendly_error(exc, "Could not list EC2 instances."))

    progress.append({
        "step": "discover_instances",
        "status": "success",
        "message": f"Found {len(instances_info)} running EC2 instance(s).",
    })

    # ── STEP G: Check CloudWatch Agent status per instance ───────────────
    if instances_info:
        try:
            agent_metrics = cw.list_metrics(Namespace="DevOpsCopilot")
            agent_instance_ids = set()
            for m in agent_metrics.get("Metrics", []):
                for dim in m.get("Dimensions", []):
                    if dim["Name"] == "InstanceId":
                        agent_instance_ids.add(dim["Value"])

            for inst in instances_info:
                if inst["instance_id"] in agent_instance_ids:
                    inst["cloudwatch_agent"] = True
        except Exception as exc:
            logger.warning("Could not check CloudWatch Agent status: %s", exc)

    progress.append({"step": "check_agent", "status": "success", "message": "Checked CloudWatch Agent status."})

    # ── STEP H: Auto-install CloudWatch Agent via SSM (best-effort) ──────
    instances_without_agent = [i for i in instances_info if not i["cloudwatch_agent"]]

    if instances_without_agent and "AmazonSSMFullAccess" in selected_permissions:
        try:
            ssm = assumed_session.client("ssm", region_name=region)
            for inst in instances_without_agent:
                iid = inst["instance_id"]
                try:
                    ssm_info = ssm.describe_instance_information(
                        Filters=[{"Key": "InstanceIds", "Values": [iid]}]
                    )
                    if not ssm_info.get("InstanceInformationList"):
                        inst["agent_install_note"] = (
                            f"CloudWatch Agent could not be auto-installed on {iid}. "
                            f"The SSM Agent is not running on this instance. "
                            f"RAM and Disk metrics will show 0 until you install it manually. "
                            f"CPU metrics are still working."
                        )
                        continue

                    # Install CloudWatch Agent package
                    ssm.send_command(
                        InstanceIds=[iid],
                        DocumentName="AWS-ConfigureAWSPackage",
                        Parameters={
                            "action": ["Install"],
                            "name": ["AmazonCloudWatchAgent"],
                        },
                        TimeoutSeconds=120,
                        Comment="DevOpsCopilot: Install CloudWatch Agent",
                    )

                    # Configure and start the agent
                    ssm.send_command(
                        InstanceIds=[iid],
                        DocumentName="AmazonCloudWatch-ManageAgent",
                        Parameters={
                            "action": ["configure"],
                            "mode": ["ec2"],
                            "optionalConfigurationSource": ["default"],
                            "optionalConfigurationLocation": [""],
                            "optionalRestart": ["yes"],
                        },
                        TimeoutSeconds=120,
                        Comment="DevOpsCopilot: Configure CloudWatch Agent",
                    )

                    inst["agent_install_note"] = "CloudWatch Agent installation started. Metrics will appear in 2-3 minutes."
                    logger.info("SSM: started CloudWatch Agent install on %s", iid)

                except ClientError as ssm_exc:
                    code = ssm_exc.response.get("Error", {}).get("Code", "")
                    if code in ("AccessDeniedException", "InvalidInstanceId"):
                        inst["agent_install_note"] = (
                            f"Could not auto-install CloudWatch Agent on {iid}. "
                            f"RAM and Disk will show 0 until installed manually. CPU still works."
                        )
                    else:
                        inst["agent_install_note"] = f"Agent install skipped for {iid}: {code}"
                    logger.warning("SSM install failed for %s: %s", iid, ssm_exc)

        except Exception as exc:
            logger.warning("SSM auto-install not available: %s", exc)
            for inst in instances_without_agent:
                if not inst.get("agent_install_note"):
                    inst["agent_install_note"] = (
                        "CloudWatch Agent auto-install is not available. "
                        "RAM and Disk will show 0 until installed manually. CPU still works."
                    )
    elif instances_without_agent:
        for inst in instances_without_agent:
            inst["agent_install_note"] = (
                "SSM permission not selected — CloudWatch Agent was not auto-installed. "
                "RAM and Disk will show 0 until installed manually. CPU still works."
            )

    progress.append({"step": "setup_agent", "status": "success", "message": "Monitoring agent setup complete."})

    # ── STEP I: Save to database (ARN + ExternalId only, NO secrets) ─────
    try:
        await db.execute(
            delete(CloudCredential).where(
                CloudCredential.user_id == user_id,
                CloudCredential.provider == provider,
            )
        )
        cred = CloudCredential(
            user_id=user_id,
            provider=provider,
            region=region,
            role_arn=role_arn,
            external_id=external_id,
            account_id=account_id,
            status="connected",
            instances_found=len(instances_info),
            connected_at=datetime.utcnow(),
            temp_credentials_expire_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.add(cred)
        await db.commit()

        progress.append({"step": "save_connection", "status": "success", "message": "Connection saved securely."})
    except Exception as exc:
        logger.error("Failed to save connection: %s", exc)
        raise HTTPException(status_code=500, detail="Could not save connection. Please try again.")

    # ── STEP J: Update runtime config for scheduler ──────────────────────
    assumed_creds = assumed_session.get_credentials().get_frozen_credentials()
    settings.aws_role_arn = role_arn
    settings.aws_access_key_id = assumed_creds.access_key
    settings.aws_secret_access_key = assumed_creds.secret_key
    settings.aws_session_token = assumed_creds.token
    settings.aws_default_region = region

    progress.append({"step": "start_monitoring", "status": "success", "message": "Metrics collection started."})

    # ── Build response ───────────────────────────────────────────────────
    return {
        "status": "connected",
        "provider": provider,
        "account_id": account_id,
        "region": region,
        "role_arn": role_arn,
        "instances_discovered": [
            {
                "instance_id": i["instance_id"],
                "name": i["name"],
                "type": i["type"],
                "state": i["state"],
                "cloudwatch_agent": i["cloudwatch_agent"],
                "ip": i["ip"],
                "agent_note": i.get("agent_install_note"),
            }
            for i in instances_info
        ],
        "monitoring_starts_in": "60 seconds",
        "message": (
            f"Connected! Found {len(instances_info)} EC2 instance(s) in {region}. "
            f"Metrics will appear on your dashboard within 60 seconds."
            if instances_info
            else f"Connected to AWS account {account_id} in {region}! No running EC2 instances found. "
                 f"Launch an EC2 instance and it will appear here automatically."
        ),
        "progress": progress,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cloud/status
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/status")
async def cloud_status(
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Returns the current cloud connection status for the authenticated user."""
    user_id = _resolve_user_id(_auth)

    # Fetch AWS credential record
    result = await db.execute(
        select(CloudCredential).where(
            CloudCredential.user_id == user_id,
            CloudCredential.provider == "aws",
        )
    )
    aws_cred = result.scalars().first()

    # Get last metric timestamp for this user
    last_metric = None
    if aws_cred:
        metric_result = await db.execute(
            select(Metric.timestamp)
            .where(Metric.source == "aws", Metric.user_id == user_id)
            .order_by(Metric.timestamp.desc())
            .limit(1)
        )
        row = metric_result.scalars().first()
        if row:
            last_metric = row.isoformat() if hasattr(row, "isoformat") else str(row)

    return {
        "aws": {
            "connected": aws_cred is not None and aws_cred.status == "connected",
            "account_id": aws_cred.account_id if aws_cred else None,
            "region": aws_cred.region if aws_cred else None,
            "role_arn": aws_cred.role_arn if aws_cred else None,
            "external_id": aws_cred.external_id if aws_cred else None,
            "instances": aws_cred.instances_found if aws_cred else 0,
            "last_metric_at": last_metric,
            "connected_at": aws_cred.connected_at.isoformat() if aws_cred and aws_cred.connected_at else None,
            "credentials_expire_at": (
                aws_cred.temp_credentials_expire_at.isoformat()
                if aws_cred and aws_cred.temp_credentials_expire_at else None
            ),
        },
        "azure": {"connected": False},
        "gcp": {"connected": False},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /cloud/disconnect
# ═══════════════════════════════════════════════════════════════════════════════

@router.delete("/disconnect")
async def disconnect_cloud(
    body: dict,
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Remove cloud credentials and stop monitoring."""
    provider = (body.get("provider") or "aws").lower()
    user_id = _resolve_user_id(_auth)

    # Delete credential record
    await db.execute(
        delete(CloudCredential).where(
            CloudCredential.user_id == user_id,
            CloudCredential.provider == provider,
        )
    )
    await db.commit()

    # Clear runtime config
    if provider == "aws":
        settings.aws_role_arn = ""
        settings.aws_access_key_id = ""
        settings.aws_secret_access_key = ""
        settings.aws_session_token = ""

    return {"status": "disconnected", "provider": provider, "message": "Cloud account disconnected."}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /cloud/instances
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/instances")
async def get_instances(
    db: AsyncSession = Depends(get_db),
    _auth: dict = Depends(require_auth),
):
    """Returns live EC2 instance list with latest metrics from the DB."""
    user_id = _resolve_user_id(_auth)

    # Get stored credentials
    result = await db.execute(
        select(CloudCredential).where(
            CloudCredential.user_id == user_id,
            CloudCredential.provider == "aws",
        )
    )
    cred = result.scalars().first()

    if not cred:
        return {"instances": [], "message": "No AWS account connected."}

    # Assume role to get fresh session
    try:
        assumed_session = _assume_role(cred.role_arn, cred.external_id, cred.region)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not assume role: {str(exc)}")

    # Fetch live instance list
    try:
        ec2 = assumed_session.client("ec2", region_name=cred.region)
        cw = assumed_session.client("cloudwatch", region_name=cred.region)

        resp = ec2.describe_instances(
            Filters=[{"Name": "instance-state-name", "Values": ["running", "stopped"]}]
        )

        # Check which instances have agent
        agent_ids = set()
        try:
            agent_resp = cw.list_metrics(Namespace="DevOpsCopilot")
            for m in agent_resp.get("Metrics", []):
                for dim in m.get("Dimensions", []):
                    if dim["Name"] == "InstanceId":
                        agent_ids.add(dim["Value"])
        except Exception:
            pass

        instances = []
        for reservation in resp.get("Reservations", []):
            for inst in reservation.get("Instances", []):
                iid = inst["InstanceId"]
                name = iid
                for tag in inst.get("Tags", []):
                    if tag["Key"] == "Name":
                        name = tag["Value"]
                        break

                # Get latest metrics from DB for this instance
                metric_result = await db.execute(
                    select(Metric)
                    .where(Metric.service_name == name, Metric.user_id == user_id)
                    .order_by(Metric.timestamp.desc())
                    .limit(1)
                )
                latest = metric_result.scalars().first()

                instances.append({
                    "instance_id": iid,
                    "name": name,
                    "type": inst.get("InstanceType", "unknown"),
                    "state": inst.get("State", {}).get("Name", "unknown"),
                    "ip": inst.get("PublicIpAddress") or inst.get("PrivateIpAddress", "N/A"),
                    "cpu": round(latest.cpu_percent, 1) if latest else 0,
                    "ram": round(latest.ram_percent, 1) if latest and latest.ram_percent else 0,
                    "disk": round(latest.disk_percent, 1) if latest and latest.disk_percent else 0,
                    "cloudwatch_agent_installed": iid in agent_ids,
                    "monitoring_status": "active" if latest else "pending",
                })

        return {"instances": instances}

    except ClientError as exc:
        raise HTTPException(status_code=400, detail=_friendly_error(exc, "Could not fetch instances."))
    except Exception as exc:
        logger.error("Failed to fetch instances: %s", exc)
        raise HTTPException(status_code=500, detail="Could not retrieve instance list.")
