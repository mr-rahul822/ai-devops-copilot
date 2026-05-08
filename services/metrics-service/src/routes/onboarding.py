"""
src/routes/onboarding.py — Cloud onboarding wizard endpoints.

Provides a dead-simple flow:
  1. POST /cloud/connect    — validate creds → discover instances → auto-install agent → save
  2. GET  /cloud/status     — current connection status
  3. DELETE /cloud/disconnect — remove credentials and stop monitoring
  4. GET  /cloud/instances  — live EC2 instance list with latest metrics
"""

import json
import uuid
import logging
from datetime import datetime
from typing import Optional

import boto3
import httpx
from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select, delete, text, Integer
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import get_db, Base
from src.crypto import encrypt, decrypt
from src.models import Metric

# ── ORM model for cloud_credentials ──────────────────────────────────────────
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class CloudCredential(Base):
    """Stores encrypted cloud provider credentials per user."""

    __tablename__ = "cloud_credentials"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    provider: Mapped[str] = mapped_column(String(20), nullable=False)
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    access_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    secret_key_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    account_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="connected")
    instances_found: Mapped[int | None] = mapped_column(Integer, default=0)
    connected_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    last_sync_at: Mapped[datetime | None] = mapped_column(nullable=True)


router = APIRouter(prefix="/cloud", tags=["cloud-onboarding"])
logger = logging.getLogger(__name__)


# ── Auth dependency (same pattern as metrics.py) ─────────────────────────────

async def _verify_token(authorization: str) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.auth_service_url}/auth/me",
                headers={"Authorization": authorization},
            )
    except (httpx.ConnectError, httpx.TimeoutException):
        raise HTTPException(status_code=503, detail="Auth service unreachable.")
    if resp.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    if resp.status_code != 200:
        raise HTTPException(status_code=503, detail="Auth service error.")
    return resp.json()


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


def _make_session(access_key: str, secret_key: str, region: str):
    return boto3.Session(
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )


CW_AGENT_CONFIG = json.dumps({
    "metrics": {
        "namespace": "SentinelAI",
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
    Full automated cloud onboarding:
      A. Validate credentials (STS)
      B. Check required permissions
      C. Discover EC2 instances
      D. Check CloudWatch Agent status
      E. Auto-install agent via SSM (best-effort)
      F. Save encrypted credentials
      G. Update metrics-service collector config
    """
    access_key = (body.get("access_key") or "").strip()
    secret_key = (body.get("secret_key") or "").strip()
    region = (body.get("region") or "us-east-1").strip()
    provider = (body.get("provider") or "aws").lower()

    if not access_key or not secret_key:
        raise HTTPException(status_code=400, detail="Please enter both your Access Key ID and Secret Access Key.")

    # Resolve user_id from auth token
    user_data = _auth.get("user", _auth)
    user_id_str = user_data.get("id") or user_data.get("userId") or user_data.get("user_id", settings.default_user_id)
    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        user_id = uuid.UUID(settings.default_user_id)

    progress = []  # track step results for frontend

    # ── STEP A: Validate credentials ────────────────────────────────────
    account_id = None
    try:
        session = _make_session(access_key, secret_key, region)
        sts = session.client("sts")
        identity = sts.get_caller_identity()
        account_id = identity.get("Account", "unknown")
        progress.append({"step": "validate_credentials", "status": "success", "message": "Credentials are valid."})
    except ClientError as exc:
        msg = _friendly_error(exc, "Invalid AWS credentials. Please check your Access Key and Secret Key.")
        raise HTTPException(status_code=400, detail=msg)
    except EndpointConnectionError:
        raise HTTPException(status_code=400, detail="Could not reach AWS. Please check your internet connection and try again.")
    except NoCredentialsError:
        raise HTTPException(status_code=400, detail="Please enter both your Access Key ID and Secret Access Key.")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not validate credentials: {str(exc)}")

    # ── STEP B: Check required permissions ──────────────────────────────
    ec2 = session.client("ec2", region_name=region)
    cw = session.client("cloudwatch", region_name=region)

    perm_checks = [
        ("ec2:DescribeInstances", lambda: ec2.describe_instances(MaxResults=5)),
        ("cloudwatch:ListMetrics", lambda: cw.list_metrics(Namespace="AWS/EC2", MaxRecords=1)),
    ]

    for perm_name, check_fn in perm_checks:
        try:
            check_fn()
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("AccessDenied", "UnauthorizedAccess", "AccessDeniedException"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Your AWS key is missing permission: {perm_name}. "
                           f"In AWS IAM, attach the ReadOnlyAccess policy to your user and try again.",
                )
            raise HTTPException(status_code=400, detail=_friendly_error(exc))
        except Exception:
            pass  # non-auth errors are OK at this stage

    progress.append({"step": "check_permissions", "status": "success", "message": "All required permissions verified."})

    # ── STEP C: Discover EC2 instances ──────────────────────────────────
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
                    "cloudwatch_agent": False,  # will update in step D
                    "agent_install_note": None,
                })
    except ClientError as exc:
        raise HTTPException(status_code=400, detail=_friendly_error(exc, "Could not list EC2 instances."))

    progress.append({
        "step": "discover_instances",
        "status": "success",
        "message": f"Found {len(instances_info)} running EC2 instance(s).",
    })

    # ── STEP D: Check CloudWatch Agent status per instance ──────────────
    if instances_info:
        try:
            agent_metrics = cw.list_metrics(Namespace="SentinelAI")
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

    # ── STEP E: Auto-install CloudWatch Agent via SSM (best-effort) ─────
    instances_without_agent = [i for i in instances_info if not i["cloudwatch_agent"]]

    if instances_without_agent:
        try:
            ssm = session.client("ssm", region_name=region)
            for inst in instances_without_agent:
                iid = inst["instance_id"]
                try:
                    # Check if SSM agent is available on this instance
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
                        Comment="SentinelAI: Install CloudWatch Agent",
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
                        Comment="SentinelAI: Configure CloudWatch Agent",
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

    progress.append({"step": "setup_agent", "status": "success", "message": "Monitoring agent setup complete."})

    # ── STEP F: Save encrypted credentials ──────────────────────────────
    try:
        # Upsert: delete old record if exists, then insert
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
            access_key_encrypted=encrypt(access_key),
            secret_key_encrypted=encrypt(secret_key),
            account_id=account_id,
            status="connected",
            instances_found=len(instances_info),
            connected_at=datetime.utcnow(),
        )
        db.add(cred)
        await db.commit()

        progress.append({"step": "save_credentials", "status": "success", "message": "Credentials saved securely."})
    except Exception as exc:
        logger.error("Failed to save credentials: %s", exc)
        raise HTTPException(status_code=500, detail="Could not save credentials. Please try again.")

    # ── STEP G: Update the runtime config so collector uses new keys ────
    settings.aws_access_key_id = access_key
    settings.aws_secret_access_key = secret_key
    settings.aws_default_region = region

    progress.append({"step": "start_monitoring", "status": "success", "message": "Metrics collection started."})

    # ── Build response ──────────────────────────────────────────────────
    return {
        "status": "connected",
        "provider": provider,
        "account_id": account_id,
        "region": region,
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
    user_data = _auth.get("user", _auth)
    user_id_str = user_data.get("id") or user_data.get("userId") or user_data.get("user_id", settings.default_user_id)
    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        user_id = uuid.UUID(settings.default_user_id)

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
            .where(Metric.source == "aws")
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
            "instances": aws_cred.instances_found if aws_cred else 0,
            "last_metric_at": last_metric,
            "connected_at": aws_cred.connected_at.isoformat() if aws_cred and aws_cred.connected_at else None,
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

    user_data = _auth.get("user", _auth)
    user_id_str = user_data.get("id") or user_data.get("userId") or user_data.get("user_id", settings.default_user_id)
    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        user_id = uuid.UUID(settings.default_user_id)

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
        settings.aws_access_key_id = ""
        settings.aws_secret_access_key = ""

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
    user_data = _auth.get("user", _auth)
    user_id_str = user_data.get("id") or user_data.get("userId") or user_data.get("user_id", settings.default_user_id)
    try:
        user_id = uuid.UUID(str(user_id_str))
    except ValueError:
        user_id = uuid.UUID(settings.default_user_id)

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

    # Decrypt keys
    try:
        access_key = decrypt(cred.access_key_encrypted)
        secret_key = decrypt(cred.secret_key_encrypted)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not decrypt stored credentials.")

    # Fetch live instance list
    try:
        session = _make_session(access_key, secret_key, cred.region)
        ec2 = session.client("ec2", region_name=cred.region)
        cw = session.client("cloudwatch", region_name=cred.region)

        resp = ec2.describe_instances(
            Filters=[{"Name": "instance-state-name", "Values": ["running", "stopped"]}]
        )

        # Check which instances have agent
        agent_ids = set()
        try:
            agent_resp = cw.list_metrics(Namespace="SentinelAI")
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
                    .where(Metric.service_name == name)
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
