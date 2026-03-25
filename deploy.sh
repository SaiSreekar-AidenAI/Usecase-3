#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="resolve-490813"
REGION="us-central1"
REPO="us-central1-docker.pkg.dev/${PROJECT_ID}/resolve-repo"

BACKEND_IMAGE="${REPO}/resolve-backend:v1"
FRONTEND_IMAGE="${REPO}/resolve-frontend:v1"
BACKEND_SERVICE="resolve-backend"
FRONTEND_SERVICE="resolve-frontend"

# ── Resolve backend URL (needed for frontend build arg) ──
BACKEND_URL="https://resolve-backend-147155498924.us-central1.run.app"

# ── Helpers ──
log() { echo -e "\n==> $1\n"; }

# ── Parse args ──
DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false

if [[ $# -eq 0 ]]; then
  DEPLOY_BACKEND=true
  DEPLOY_FRONTEND=true
else
  for arg in "$@"; do
    case "$arg" in
      backend)  DEPLOY_BACKEND=true ;;
      frontend) DEPLOY_FRONTEND=true ;;
      *)        echo "Usage: ./deploy.sh [backend] [frontend]"; exit 1 ;;
    esac
  done
fi

# ── Backend ──
if $DEPLOY_BACKEND; then
  log "Building backend image..."
  cd backend
  gcloud builds submit --tag "$BACKEND_IMAGE" --project "$PROJECT_ID" --quiet

  log "Deploying backend to Cloud Run..."
  gcloud run deploy "$BACKEND_SERVICE" \
    --image "$BACKEND_IMAGE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --allow-unauthenticated \
    --quiet
  cd ..
fi

# ── Frontend ──
if $DEPLOY_FRONTEND; then
  log "Building frontend image..."
  cd frontend
  gcloud builds submit \
    --config cloudbuild.yaml \
    --project "$PROJECT_ID" \
    --substitutions="_BACKEND_URL=${BACKEND_URL}" \
    --quiet

  log "Deploying frontend to Cloud Run..."
  gcloud run deploy "$FRONTEND_SERVICE" \
    --image "$FRONTEND_IMAGE" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --allow-unauthenticated \
    --quiet
  cd ..
fi

log "Done! 🎉"
echo "  Backend:  https://$(gcloud run services describe $BACKEND_SERVICE --region $REGION --project $PROJECT_ID --format='value(status.url)' 2>/dev/null || echo 'resolve-backend-bjvzn2f7yq-uc.a.run.app')"
echo "  Frontend: https://$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --project $PROJECT_ID --format='value(status.url)' 2>/dev/null || echo 'resolve-frontend-bjvzn2f7yq-uc.a.run.app')"
