"""
src/executors/__init__.py — Executor registry.

Provides get_executor() to look up the right executor by type.
"""

from src.executors.docker_executor import DockerExecutor
from src.executors.aws_executor import AWSExecutor

_EXECUTORS = {
    "docker": DockerExecutor,
    "aws": AWSExecutor,
}


def get_executor(executor_type: str):
    """Return an executor instance for the given type, or raise ValueError."""
    cls = _EXECUTORS.get(executor_type)
    if cls is None:
        raise ValueError(
            f"Unknown executor type '{executor_type}'. "
            f"Available: {list(_EXECUTORS.keys())}"
        )
    return cls()
