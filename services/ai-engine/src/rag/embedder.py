"""
src/rag/embedder.py — Local text → vector embedding using raw ONNX.

Uses 'all-MiniLM-L6-v2' (384 dimensions).
The model is loaded using onnxruntime instead of sentence-transformers
to completely avoid PyTorch hidden dependencies.
"""

import logging
from typing import List
import numpy as np

from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer
import onnxruntime as ort

from src.config import settings

logger = logging.getLogger(__name__)

# Module-level singletons
_tokenizer: AutoTokenizer | None = None
_session: ort.InferenceSession | None = None


def _get_models():
    global _tokenizer, _session
    if _session is None:
        logger.info("Loading tokenizer from '%s'...", settings.embedding_model)
        _tokenizer = AutoTokenizer.from_pretrained(settings.embedding_model)
        
        logger.info("Downloading ONNX model (if not cached)...")
        model_path = hf_hub_download(repo_id=settings.embedding_model, filename="onnx/model.onnx")
        
        logger.info("Loading ONNX Inference Session...")
        _session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
        logger.info("ONNX Embedding model loaded successfully.")
    return _tokenizer, _session


def _mean_pooling(token_embeddings: np.ndarray, attention_mask: np.ndarray) -> np.ndarray:
    """Mean pooling to get sentence embeddings from token embeddings."""
    input_mask_expanded = np.expand_dims(attention_mask, axis=-1)
    sum_embeddings = np.sum(token_embeddings * input_mask_expanded, axis=1)
    sum_mask = np.clip(np.sum(input_mask_expanded, axis=1), a_min=1e-9, a_max=None)
    return sum_embeddings / sum_mask


def _normalize(embeddings: np.ndarray) -> np.ndarray:
    """L2 normalization of embeddings."""
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms = np.clip(norms, a_min=1e-12, a_max=None)
    return embeddings / norms


class Embedder:
    """Converts text strings into dense vector embeddings."""

    def embed_text(self, text: str) -> List[float]:
        """Embed a single text string → list of floats (384 dimensions)."""
        return self.embed_batch([text])[0]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts at once using ONNX inference."""
        tokenizer, session = _get_models()
        
        # Tokenize
        encoded = tokenizer(
            texts, 
            padding=True, 
            truncation=True, 
            return_tensors='np'
        )
        
        # Prepare ONNX inputs
        feed_dict = {
            "input_ids": encoded["input_ids"].astype(np.int64),
            "attention_mask": encoded["attention_mask"].astype(np.int64),
            "token_type_ids": encoded["token_type_ids"].astype(np.int64)
        }
        
        # Run inference
        outputs = session.run(None, feed_dict)
        token_embeddings = outputs[0]  # last_hidden_state is the first output
        
        # Pool and normalize
        sentence_embeddings = _mean_pooling(token_embeddings, encoded["attention_mask"])
        sentence_embeddings = _normalize(sentence_embeddings)
        
        return sentence_embeddings.tolist()
