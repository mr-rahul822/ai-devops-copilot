"""
src/rag/embedder.py — Local text → vector embedding using sentence-transformers.

Uses 'all-MiniLM-L6-v2' (384 dimensions, ~90 MB download on first run).
The model is cached in memory after first load and on disk via the
HuggingFace cache directory (mount a Docker volume to persist it).
"""

import logging
from typing import List

from sentence_transformers import SentenceTransformer

from src.config import settings

logger = logging.getLogger(__name__)

# Module-level singleton — loaded once, reused forever.
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading embedding model '%s' (first time may download ~90 MB)...", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        logger.info("Embedding model loaded. Dimension: %d", _model.get_sentence_embedding_dimension())
    return _model


class Embedder:
    """Converts text strings into dense vector embeddings."""

    def embed_text(self, text: str) -> List[float]:
        """Embed a single text string → list of floats (384 dimensions)."""
        model = _get_model()
        embedding = model.encode(text, normalize_embeddings=True)
        return embedding.tolist()

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts at once (uses batched inference for speed)."""
        model = _get_model()
        embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32)
        return [e.tolist() for e in embeddings]
