from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    env: str = "local"  # "local" or "production"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    excel_data_path: str = str(Path(__file__).resolve().parent.parent.parent / "Canned_Responses_Templatefull.xlsx")

    # Cloud SQL (asyncpg DSN) — production only
    database_url: str = ""

    # Local dev paths
    sqlite_path: str = str(Path(__file__).resolve().parent.parent / "data" / "local.db")
    chroma_persist_dir: str = str(Path(__file__).resolve().parent.parent / "data" / "chroma")

    # BigQuery vector store — production only
    gcp_project_id: str = "resolve-490813"
    bq_dataset: str = "resolve_vectors"
    bq_table: str = "canned_responses"

    # Vertex AI embeddings — production only
    embedding_model: str = "text-embedding-005"
    embedding_location: str = "us-central1"

    # CORS
    allowed_origins: str = "*"

    model_config = {"env_file": str(Path(__file__).resolve().parent.parent / ".env")}

    @property
    def is_local(self) -> bool:
        return self.env.lower() == "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()
