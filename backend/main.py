import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db, close_db
from app.llm import init_client
from app.routes import health, generate, history

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # Startup
    logger.info(f"Starting in {settings.env} mode...")
    logger.info("Initializing database...")
    await init_db()

    if settings.is_local:
        from app.chroma import init_chroma
        logger.info("Initializing ChromaDB vector store...")
        init_chroma()
    else:
        from app.vector_store import init_vector_store
        logger.info("Initializing BigQuery vector store...")
        init_vector_store()

    logger.info("Initializing Gemini client...")
    init_client()
    logger.info("Backend ready.")
    yield
    # Shutdown
    logger.info("Closing database...")
    await close_db()


app = FastAPI(title="Resolve AI Support Console API", lifespan=lifespan)

settings = get_settings()
origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(generate.router)
app.include_router(history.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
