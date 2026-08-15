# deploy.config/

Per-project deployment configuration for `./deploy.sh`.

Each `<name>.env` file is sourced as shell vars by `deploy.sh` when you
invoke it with `--env <name>`:

```bash
# Deploy to resolve-490813
export DB_PASS='…'
./deploy.sh --env resolve

# Deploy to gtm-cloud-helpdesk
export DB_PASS='…'
./deploy.sh --env gtm

# Backend only
./deploy.sh --env resolve backend
```

## Adding a new project

Copy one of the existing files, rename it, and fill in the values:

```bash
cp deploy.config/resolve.env deploy.config/my-project.env
# edit my-project.env
./deploy.sh --env my-project
```

## Fields

| Var | Meaning |
|---|---|
| `GCP_ACCOUNT` | Google account (`gcloud config set account …`). Optional. |
| `PROJECT_ID` | GCP project ID. |
| `REGION` | Cloud Run / Cloud SQL / Artifact Registry region. |
| `REPO_NAME` | Artifact Registry Docker repo name. |
| `BACKEND_SERVICE` / `FRONTEND_SERVICE` | Cloud Run service names. |
| `CLOUD_SQL_INSTANCE_NAME` | Cloud SQL instance (without `PROJECT:REGION:` prefix). |
| `DB_USER`, `DB_NAME` | Postgres user + database. |
| `BQ_DATASET`, `BQ_TABLE` | BigQuery vector store location. |
| `GEMINI_SECRET_NAME` | Secret Manager secret holding the Gemini API key. |

## Secrets

**Never put secrets in these files.** `DB_PASS` and API keys stay in your
shell env or Secret Manager. The config files are safe to commit.
