"""
src/executors/docker_executor.py — Execute actions on Docker containers.

Uses the Docker SDK (docker-py) to restart, stop, fetch logs, and get stats
for containers accessible via the mounted Docker socket.

All Docker SDK calls are synchronous, so they are wrapped in
asyncio.get_event_loop().run_in_executor() to avoid blocking the event loop.
"""

import asyncio
import logging
import platform
import time

import docker
from docker.errors import NotFound, APIError

from src.executors.base_executor import BaseExecutor

logger = logging.getLogger(__name__)

SUPPORTED_ACTIONS = [
    "restart_container",
    "stop_container",
    "fetch_container_logs",
    "get_container_stats",
]


class DockerExecutor(BaseExecutor):
    """Executes infrastructure actions against the Docker daemon."""

    def __init__(self):
        try:
            if platform.system() == "Windows":
                self._client = docker.DockerClient(base_url="npipe:////./pipe/docker_engine")
            else:
                self._client = docker.DockerClient(base_url="unix://var/run/docker.sock")
            self._client.ping()
            self._connected = True
            logger.info("Docker client connected successfully")
        except Exception as e:
            logger.error(f"Docker client connection failed: {e}. Container actions will not work.")
            self._client = None
            self._connected = False

    @property
    def executor_type(self) -> str:
        return "docker"

    @property
    def is_connected(self) -> bool:
        """Check if the Docker daemon is reachable."""
        if not self._connected or self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            return False

    def validate(self, action: dict) -> bool:
        action_type = action.get("action_type", "")
        if action_type not in SUPPORTED_ACTIONS:
            return False
        if not action.get("target_service"):
            return False
        return True

    async def execute(self, action: dict) -> dict:
        """Dispatch to the correct Docker action handler."""
        if self._client is None:
            raise RuntimeError("Docker client is not available. Check Docker socket mount.")

        action_type = action.get("action_type")
        target = action.get("target_service")
        params = action.get("params", {})

        handlers = {
            "restart_container": self._restart_container,
            "stop_container": self._stop_container,
            "fetch_container_logs": self._fetch_container_logs,
            "get_container_stats": self._get_container_stats,
        }

        handler = handlers.get(action_type)
        if handler is None:
            return self.build_result(
                False, f"Unsupported Docker action: {action_type}"
            )

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, handler, target, params)

    # ── ACTION 1: restart_container ───────────────────────────────────────

    def _restart_container(self, target: str, params: dict) -> dict:
        if self._client is None:
            raise RuntimeError("Docker client is not available. Check Docker socket mount.")
        try:
            container = self._client.containers.get(target)
            previous_status = container.status
            logger.info(
                "[DOCKER] Restarting container '%s' (current: %s)",
                target, previous_status,
            )

            timeout = params.get("timeout", 30)
            container.restart(timeout=timeout)

            # Brief wait then check new status
            time.sleep(3)
            container.reload()
            new_status = container.status

            logger.info(
                "[DOCKER] Container '%s' restarted: %s → %s",
                target, previous_status, new_status,
            )
            return self.build_result(
                success=True,
                message=f"Container '{target}' restarted successfully",
                details={
                    "previous_status": previous_status,
                    "new_status": new_status,
                    "container_id": container.short_id,
                },
            )
        except NotFound:
            return self.build_result(
                False, f"Container '{target}' not found"
            )
        except APIError as e:
            return self.build_result(
                False, f"Docker API error: {e.explanation}"
            )
        except Exception as e:
            return self.build_result(False, f"Unexpected error: {str(e)}")

    # ── ACTION 2: stop_container ──────────────────────────────────────────

    def _stop_container(self, target: str, params: dict) -> dict:
        if self._client is None:
            raise RuntimeError("Docker client is not available. Check Docker socket mount.")
        try:
            container = self._client.containers.get(target)

            if container.status in ("exited", "dead", "created"):
                return self.build_result(
                    success=True,
                    message=f"Container '{target}' is already stopped (status: {container.status})",
                    details={"status": container.status},
                )

            logger.info("[DOCKER] Stopping container '%s'", target)
            timeout = params.get("timeout", 30)
            container.stop(timeout=timeout)

            container.reload()
            return self.build_result(
                success=True,
                message=f"Container '{target}' stopped",
                details={
                    "status": container.status,
                    "container_id": container.short_id,
                },
            )
        except NotFound:
            return self.build_result(
                False, f"Container '{target}' not found"
            )
        except APIError as e:
            return self.build_result(
                False, f"Docker API error: {e.explanation}"
            )
        except Exception as e:
            return self.build_result(False, f"Unexpected error: {str(e)}")

    # ── ACTION 3: fetch_container_logs ────────────────────────────────────

    def _fetch_container_logs(self, target: str, params: dict) -> dict:
        if self._client is None:
            raise RuntimeError("Docker client is not available. Check Docker socket mount.")
        try:
            container = self._client.containers.get(target)

            tail = params.get("tail", 100)
            raw_logs = container.logs(tail=tail, timestamps=True).decode(
                "utf-8", errors="replace"
            )
            line_count = len(raw_logs.splitlines())

            logger.info(
                "[DOCKER] Fetched %d log lines from '%s'", line_count, target
            )
            return self.build_result(
                success=True,
                message=f"Fetched {line_count} log lines from '{target}'",
                details={
                    "logs": raw_logs,
                    "line_count": line_count,
                    "container_id": container.short_id,
                },
            )
        except NotFound:
            return self.build_result(
                False, f"Container '{target}' not found"
            )
        except APIError as e:
            return self.build_result(
                False, f"Docker API error: {e.explanation}"
            )
        except Exception as e:
            return self.build_result(False, f"Unexpected error: {str(e)}")

    # ── ACTION 4: get_container_stats ─────────────────────────────────────

    def _get_container_stats(self, target: str, params: dict) -> dict:
        if self._client is None:
            raise RuntimeError("Docker client is not available. Check Docker socket mount.")
        try:
            container = self._client.containers.get(target)

            # stream=False gives a single snapshot
            stats = container.stats(stream=False)

            # Parse CPU usage
            cpu_delta = (
                stats["cpu_stats"]["cpu_usage"]["total_usage"]
                - stats["precpu_stats"]["cpu_usage"]["total_usage"]
            )
            system_delta = (
                stats["cpu_stats"]["system_cpu_usage"]
                - stats["precpu_stats"]["system_cpu_usage"]
            )
            num_cpus = stats["cpu_stats"].get("online_cpus", 1)
            cpu_percent = 0.0
            if system_delta > 0:
                cpu_percent = round(
                    (cpu_delta / system_delta) * num_cpus * 100.0, 2
                )

            # Parse memory usage
            mem_usage_bytes = stats["memory_stats"].get("usage", 0)
            mem_limit_bytes = stats["memory_stats"].get("limit", 1)
            memory_mb = round(mem_usage_bytes / (1024 * 1024), 2)
            memory_limit_mb = round(mem_limit_bytes / (1024 * 1024), 2)

            logger.info(
                "[DOCKER] Stats for '%s': CPU=%.1f%%, MEM=%.1fMB",
                target, cpu_percent, memory_mb,
            )
            return self.build_result(
                success=True,
                message=f"Stats retrieved for '{target}'",
                details={
                    "cpu_percent": cpu_percent,
                    "memory_mb": memory_mb,
                    "memory_limit_mb": memory_limit_mb,
                    "container_id": container.short_id,
                    "status": container.status,
                },
            )
        except NotFound:
            return self.build_result(
                False, f"Container '{target}' not found"
            )
        except APIError as e:
            return self.build_result(
                False, f"Docker API error: {e.explanation}"
            )
        except (KeyError, TypeError) as e:
            return self.build_result(
                False, f"Failed to parse container stats: {str(e)}"
            )
        except Exception as e:
            return self.build_result(False, f"Unexpected error: {str(e)}")
