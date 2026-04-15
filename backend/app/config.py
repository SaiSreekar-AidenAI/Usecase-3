from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3-pro-preview"
    excel_data_path: str = str(Path(__file__).resolve().parent.parent / "Canned_Responses_Templatefull.xlsx")

    # Cloud SQL (asyncpg DSN)
    database_url: str = ""

    # BigQuery vector store
    gcp_project_id: str = "gtm-cloud-helpdesk"
    bq_dataset: str = "email_composer_vectors"
    bq_table: str = "canned_responses"

    # Vertex AI embeddings
    embedding_model: str = "text-embedding-005"
    embedding_location: str = "us-central1"

    # CORS
    allowed_origins: str = "*"

    # Auth
    session_ttl_hours: int = 24
    seed_admin_email: str = "admin@email-composer.ai"
    seed_admin_password: str = "admin123"
    seed_admin_name: str = "System Admin"

    # JWT
    jwt_secret_key: str = "local-dev-secret-change-in-production"
    jwt_access_token_expire_minutes: int = 30

    # Analytics
    event_queue_batch_size: int = 50
    event_queue_flush_interval_s: float = 2.0
    security_working_hours_start: int = 9
    security_working_hours_end: int = 18
    security_rapid_request_threshold: int = 50
    security_failed_login_threshold: int = 5

    model_config = {"env_file": str(Path(__file__).resolve().parent.parent / ".env")}


@lru_cache
def get_settings() -> Settings:
    return Settings()
