import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.audit.event_queue import start_event_processor, stop_event_processor
from app.audit.geo import close_client as close_geo_client
from app.auth.enforcer import init_enforcer
from app.auth.middleware import AuthMiddleware
from app.config import get_settings
from app.database import init_db, close_db, seed_admin_user, delete_expired_sessions
from app.llm import init_client
from app.routes import health, generate, history, auth, users, analytics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    # Startup
    logger.info(f"Starting in {settings.env} mode...")
    logger.info("Initializing database...")
    await init_db()

    logger.info("Initializing Casbin enforcer...")
    init_enforcer()

    logger.info("Seeding admin user...")
    await seed_admin_user(
        settings.seed_admin_email,
        settings.seed_admin_password,
        settings.seed_admin_name,
    )

    logger.info("Cleaning expired sessions...")
    await delete_expired_sessions()

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

    logger.info("Starting audit event processor...")
    await start_event_processor()

    logger.info("Backend ready.")
    yield
    # Shutdown
    logger.info("Stopping audit event processor...")
    await stop_event_processor()
    await close_geo_client()
    logger.info("Closing database...")
    await close_db()


app = FastAPI(title="Email Composer AI API", lifespan=lifespan)

settings = get_settings()
origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]

# When credentials are used, browsers reject Access-Control-Allow-Origin: *
# Use allow_origin_regex to reflect the actual origin instead
if origins == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Access-Token"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Access-Token"],
    )

app.add_middleware(AuthMiddleware)

app.include_router(health.router)
app.include_router(generate.router)
app.include_router(history.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(analytics.router)

# Serve React frontend build (same origin = no CORS issues)
# Check Docker path first, then local dev path
_frontend_build = Path(__file__).resolve().parent / "frontend-build"
if not _frontend_build.is_dir():
    _frontend_build = Path(__file__).resolve().parent.parent / "frontend" / "build"
if _frontend_build.is_dir():
    app.mount("/static", StaticFiles(directory=_frontend_build / "static"), name="static-files")

    @app.get("/{full_path:path}")
    async def serve_frontend(request: Request, full_path: str):
        # Serve actual files if they exist, otherwise index.html for client-side routing
        file_path = _frontend_build / full_path
        if full_path and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_frontend_build / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
