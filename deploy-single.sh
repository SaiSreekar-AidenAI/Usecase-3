#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="gtm-cloud-helpdesk"
REGION="us-central1"
SERVICE="email-composer"
REPO="us-central1-docker.pkg.dev/${PROJECT_ID}/email-composer-repo"
IMAGE="${REPO}/${SERVICE}:v1"
CLOUD_SQL_INSTANCE="${PROJECT_ID}:${REGION}:email-composer-db"

echo "=== Step 1: Enable required APIs ==="
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  --project "$PROJECT_ID"

echo "=== Step 2: Create Artifact Registry repo (if needed) ==="
gcloud artifacts repositories create email-composer-repo \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null || echo "Repo already exists"

echo "=== Step 3: Build image with Cloud Build ==="
gcloud builds submit \
  --tag "$IMAGE" \
  --project "$PROJECT_ID" \
  .

echo "=== Step 4: Deploy to Cloud Run ==="
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --allow-unauthenticated \
  --add-cloudsql-instances="$CLOUD_SQL_INSTANCE" \
  --set-env-vars="ENV=production" \
  --set-env-vars="DATABASE_URL=postgresql://ec_user:EcPass2024@/email_composer?host=/cloudsql/${CLOUD_SQL_INSTANCE}" \
  --set-env-vars="GCP_PROJECT_ID=${PROJECT_ID}" \
  --set-env-vars="EXCEL_DATA_PATH=/data/Canned_Responses_Templatefull.xlsx" \
  --set-env-vars="JWT_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')" \
  --min-instances=0 \
  --max-instances=2 \
  --memory=512Mi \
  --quiet

echo ""
echo "=== Deployed! ==="
URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')
echo "URL: $URL"
echo "Login: admin@email-composer.ai / admin123"
