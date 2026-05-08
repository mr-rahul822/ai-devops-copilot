"""
src/main.py — FastAPI application entry point for the AI Engine.

Initialises all singletons (Claude client, Pinecone vector store,
RAG retriever, httpx client) once at startup and tears them down
on shutdown.
"""

import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.database import init_db
from src.llm.client import ClaudeClient
from src.rag.vector_store import VectorStore
from src.rag.retriever import Retriever
from src.services.diagnosis_service import DiagnosisService
from src.services.chat_service import ChatService
from src.agents.orchestrator import AgentOrchestrator

# ── Logging ──────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Module-level singletons (set during lifespan startup) ────────────────

claude_client: ClaudeClient = None  # type: ignore
vector_store: VectorStore = None  # type: ignore
retriever: Retriever = None  # type: ignore
http_client: httpx.AsyncClient = None  # type: ignore
diagnosis_service: DiagnosisService = None  # type: ignore
chat_service: ChatService = None  # type: ignore
orchestrator: AgentOrchestrator = None  # type: ignore


# ── Lifespan ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global claude_client, vector_store, retriever, http_client
    global diagnosis_service, chat_service, orchestrator

    logger.info("Starting AI Engine...")

    # 1. Database
    await init_db()

    # 2. Claude LLM client
    claude_client = ClaudeClient()

    # 3. Pinecone vector store
    vector_store = VectorStore()
    await vector_store.init()

    # 4. RAG retriever
    retriever = Retriever(vector_store)

    # 5. Shared httpx client (reused across all requests)
    http_client = httpx.AsyncClient(timeout=10.0)

    # 6. Service orchestrators
    diagnosis_service = DiagnosisService(claude_client, retriever, http_client)
    chat_service = ChatService(claude_client, retriever, http_client)

    # 7. Multi-agent orchestrator (Phase 5)
    orchestrator = AgentOrchestrator(claude_client, retriever)

    logger.info("AI Engine ready — port %d", settings.port)

    yield

    # ── Shutdown ──────────────────────────────────────────────────────
    await http_client.aclose()
    logger.info("AI Engine shut down cleanly.")


# ── App ──────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Sentinel AI — AI Engine",
    description="LLM-powered diagnosis, RAG, and chat for cloud infrastructure",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────────

from src.routes.diagnose import router as diagnose_router
from src.routes.chat import router as chat_router
from src.routes.incidents import router as incidents_router
from src.routes.analyze import router as analyze_router

app.include_router(diagnose_router)
app.include_router(chat_router)
app.include_router(incidents_router)
app.include_router(analyze_router, prefix="/ai")


# ── Health check ─────────────────────────────────────────────────────────

@app.get("/ai/health")
async def health():
    return {
        "status": "ok",
        "pinecone": "connected" if vector_store and vector_store.connected else "disconnected",
        "llm": "ready" if claude_client else "not initialized",
    }
