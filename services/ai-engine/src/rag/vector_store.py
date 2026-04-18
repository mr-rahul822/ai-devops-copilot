"""
src/rag/vector_store.py — Pinecone vector database operations.

Index: 'devops-incidents'
Dimension: 384 (matches all-MiniLM-L6-v2)
Metric: cosine
"""

import logging
import time
from typing import Optional

from pinecone import Pinecone, ServerlessSpec

from src.config import settings
from src.rag.embedder import Embedder

logger = logging.getLogger(__name__)


class VectorStore:
    """Manages the Pinecone vector index for incident RAG."""

    def __init__(self):
        self._embedder = Embedder()
        self._pc: Optional[Pinecone] = None
        self._index = None
        self._connected = False

    async def init(self):
        """
        Initialises the Pinecone client and creates the index if it
        doesn't exist.  This is called once during FastAPI startup.
        """
        if not settings.pinecone_api_key:
            logger.warning("PINECONE_API_KEY not set — vector store disabled.")
            return

        try:
            self._pc = Pinecone(api_key=settings.pinecone_api_key)

            existing = [idx.name for idx in self._pc.list_indexes()]

            if settings.pinecone_index_name not in existing:
                logger.info("Creating Pinecone index '%s'...", settings.pinecone_index_name)
                self._pc.create_index(
                    name=settings.pinecone_index_name,
                    dimension=384,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                )
                # Wait for index to be ready
                while not self._pc.describe_index(settings.pinecone_index_name).status.get("ready"):
                    logger.info("Waiting for index to be ready...")
                    time.sleep(2)

            self._index = self._pc.Index(settings.pinecone_index_name)
            self._connected = True
            logger.info("Pinecone index '%s' ready.", settings.pinecone_index_name)
        except Exception as exc:
            logger.error("Pinecone initialization failed: %s", exc)
            self._connected = False

    @property
    def connected(self) -> bool:
        return self._connected

    # ── Upsert ───────────────────────────────────────────────────────────

    async def upsert_incident(self, incident_id: str, text: str, metadata: dict):
        """Embed text and store the vector + metadata in Pinecone."""
        if not self._connected or self._index is None:
            logger.warning("Pinecone not connected — skipping upsert.")
            return

        try:
            vector = self._embedder.embed_text(text)
            # Pinecone metadata values must be strings, numbers, booleans, or lists of strings
            clean_meta = {k: str(v) if v is not None else "" for k, v in metadata.items()}
            self._index.upsert(vectors=[(incident_id, vector, clean_meta)])
            logger.info("Upserted incident %s into Pinecone.", incident_id)
        except Exception as exc:
            logger.error("Pinecone upsert failed for %s: %s", incident_id, exc)

    # ── Search ───────────────────────────────────────────────────────────

    async def search_similar(self, query_text: str, user_id: str, top_k: int = 3) -> list[dict]:
        """
        Embed the query, search Pinecone with user_id filter, return top_k results.
        Each result: {"id": str, "score": float, "metadata": dict}
        """
        if not self._connected or self._index is None:
            logger.debug("Pinecone not connected — returning empty results.")
            return []

        try:
            vector = self._embedder.embed_text(query_text)
            results = self._index.query(
                vector=vector,
                top_k=top_k,
                include_metadata=True,
                filter={"user_id": {"$eq": user_id}},
            )
            matches = []
            for match in results.get("matches", []):
                matches.append({
                    "id": match["id"],
                    "score": match["score"],
                    "metadata": match.get("metadata", {}),
                })
            return matches
        except Exception as exc:
            logger.error("Pinecone search failed: %s", exc)
            return []

    # ── Delete ───────────────────────────────────────────────────────────

    async def delete_incident(self, incident_id: str):
        """Remove a single vector by its ID."""
        if not self._connected or self._index is None:
            return
        try:
            self._index.delete(ids=[incident_id])
            logger.info("Deleted incident %s from Pinecone.", incident_id)
        except Exception as exc:
            logger.error("Pinecone delete failed for %s: %s", incident_id, exc)
