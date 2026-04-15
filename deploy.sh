#!/usr/bin/env bash
set -uo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
PROJECT_ID="${PROJECT_ID:-gtm-cloud-helpdesk}"
REGION="${REGION:-us-central1}"
REPO="us-central1-docker.pkg.dev/${PROJECT_ID}/email-composer-repo"

BACKEND_IMAGE="${REPO}/email-composer-backend:v1"
FRONTEND_IMAGE="${REPO}/email-composer-frontend:v1"
BACKEND_SERVICE="email-composer-backend"
FRONTEND_SERVICE="email-composer-frontend"
BACKEND_URL=""  # Set after first deploy

# Cloud SQL (Postgres) — connected via the Cloud SQL Auth Proxy sidecar in Cloud Run.
# DATABASE_URL uses asyncpg's Unix-socket form: postgresql://USER:PASS@/DBNAME?host=/cloudsql/INSTANCE
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-${PROJECT_ID}:${REGION}:email-composer-db}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-}"  # REQUIRED — export DB_PASS before running
DB_NAME="${DB_NAME:-email_composer}"

# BigQuery vector store
BQ_DATASET="${BQ_DATASET:-email_composer_vectors}"
BQ_TABLE="${BQ_TABLE:-canned_responses}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Color / ANSI constants ─────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  RST='\e[0m'
  RED='\e[1;31m'
  GRN='\e[1;32m'
  YLW='\e[1;33m'
  CYN='\e[1;36m'
  BLD='\e[1m'
  DIM='\e[2m'
  BAR_BG='\e[44m'
  BAR_FG='\e[1;37m'
  IS_TTY=true
else
  RST='' RED='' GRN='' YLW='' CYN='' BLD='' DIM='' BAR_BG='' BAR_FG=''
  IS_TTY=false
fi

# ── Spinner ────────────────────────────────────────────────────────────────────
if locale charmap 2>/dev/null | grep -qi utf; then
  SPINNER_CHARS=( '⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏' )
  SYM_OK='✔' SYM_FAIL='✖' SYM_ARROW='▶' SYM_INFO='ℹ' SYM_SEP='─'
else
  SPINNER_CHARS=( '|' '/' '-' '\' )
  SYM_OK='ok' SYM_FAIL='!!' SYM_ARROW='>>' SYM_INFO='i' SYM_SEP='-'
fi
SPINNER_IDX=0

# ── State variables ────────────────────────────────────────────────────────────
CURRENT_STEP=""
CURRENT_STEP_NUM=0
TOTAL_STEPS=0
START_TIME=$(date +%s)
DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false
UI_ACTIVE=false
ROWS=24
COLS=80

# ── Temp directory for log capture ─────────────────────────────────────────────
TMPDIR_DEPLOY=$(mktemp -d 2>/dev/null || mktemp -d -t deploy)
LAST_LOG="$TMPDIR_DEPLOY/last_cmd.log"

# ── Terminal helpers ───────────────────────────────────────────────────────────
get_term_size() {
  if $IS_TTY; then
    ROWS=$(tput lines 2>/dev/null || echo 24)
    COLS=$(tput cols 2>/dev/null || echo 80)
  fi
}

setup_ui() {
  $IS_TTY || return 0
  get_term_size
  (( ROWS < 6 )) && return 0
  UI_ACTIVE=true
  printf '\e[2J\e[H'                       # clear screen, cursor home
  printf '\e[1;%dr' "$((ROWS - 2))"        # scroll region: top to ROWS-2
  printf '\e[H'                             # cursor to top-left
  draw_status_bar
}

teardown_ui() {
  $UI_ACTIVE || return 0
  UI_ACTIVE=false
  get_term_size
  printf '\e[1;%dr' "$ROWS"                # reset scroll region
  printf '\e[%d;1H' "$((ROWS - 1))"        # move below old status area
  printf '\e[2K\e[B\e[2K'                  # clear the two status lines
  printf '\e[%d;1H' "$((ROWS - 1))"        # park cursor
}

draw_status_bar() {
  $UI_ACTIVE || return 0
  get_term_size

  local elapsed=$(( $(date +%s) - START_TIME ))
  local mins=$(( elapsed / 60 ))
  local secs=$(( elapsed % 60 ))
  local time_str
  time_str=$(printf '%02d:%02d' "$mins" "$secs")

  local progress=""
  (( TOTAL_STEPS > 0 )) && progress="[${CURRENT_STEP_NUM}/${TOTAL_STEPS}]"

  local spin="${SPINNER_CHARS[SPINNER_IDX]}"
  SPINNER_IDX=$(( (SPINNER_IDX + 1) % ${#SPINNER_CHARS[@]} ))

  # Build content string (plain, for length calc)
  local content=" ${spin} ${progress}  ${CURRENT_STEP}  T ${time_str} "
  local pad_len=$(( COLS - ${#content} ))
  (( pad_len < 0 )) && pad_len=0

  printf '\e7'                                        # save cursor
  # separator line
  printf '\e[%d;1H\e[2K' "$((ROWS - 1))"
  printf "${DIM}"
  printf '%*s' "$COLS" '' | tr ' ' "$SYM_SEP"
  printf "${RST}"
  # bar line
  printf '\e[%d;1H\e[2K' "$ROWS"
  printf "${BAR_BG}${BAR_FG}"
  printf ' %s %s  %s  T %s ' "$spin" "$progress" "$CURRENT_STEP" "$time_str"
  printf '%*s' "$pad_len" ''
  printf "${RST}"
  printf '\e8'                                        # restore cursor
}

# ── Logging ────────────────────────────────────────────────────────────────────
log_info()    { printf "  ${CYN}${SYM_INFO} %s${RST}\n" "$1"; }
log_step()    { printf "\n  ${YLW}${SYM_ARROW} %s${RST}\n" "$1"; }
log_success() { printf "  ${GRN}${SYM_OK} %s${RST}\n" "$1"; }
log_error()   { printf "  ${RED}${SYM_FAIL} %s${RST}\n" "$1"; }
log_dim()     { printf "  ${DIM}  %s${RST}\n" "$1"; }

# ── Phase tracking ─────────────────────────────────────────────────────────────
build_phase_list() {
  TOTAL_STEPS=0
  $DEPLOY_BACKEND  && (( TOTAL_STEPS += 2 ))
  $DEPLOY_FRONTEND && (( TOTAL_STEPS += 2 ))
}

begin_phase() {
  CURRENT_STEP_NUM=$((CURRENT_STEP_NUM + 1))
  CURRENT_STEP="$1"
  log_step "$1"
  draw_status_bar
}

# ── Stream output with status bar refresh ──────────────────────────────────────
stream_with_status() {
  while IFS= read -r -t 0.5 line || {
    # timeout — just redraw status bar and keep reading
    if [[ $? -gt 128 ]]; then
      draw_status_bar
      continue
    fi
    # EOF — break
    false
  }; do
    if [[ -n "$line" ]]; then
      log_dim "$line"
    fi
    draw_status_bar
  done
}

# ── Command execution ──────────────────────────────────────────────────────────
run_cmd() {
  > "$LAST_LOG"
  local exit_code=0
  "$@" 2>&1 | tee "$LAST_LOG" | stream_with_status || true
  exit_code=${PIPESTATUS[0]}
  return "$exit_code"
}

run_phase() {
  local phase_name="$1"
  shift
  begin_phase "$phase_name"

  if run_cmd "$@"; then
    log_success "$phase_name"
  else
    log_error "$phase_name -- FAILED"
    exit 1
  fi
}

# ── Cleanup ────────────────────────────────────────────────────────────────────
cleanup() {
  local exit_code=$?
  teardown_ui

  if (( exit_code != 0 )); then
    printf '\n'
    log_error "Deployment failed during: ${CURRENT_STEP:-unknown step}"
    printf '\n'
    if [[ -s "$LAST_LOG" ]]; then
      printf "  ${RED}%s Error Output %s${RST}\n" "━━━" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      tail -30 "$LAST_LOG" | while IFS= read -r errline; do
        printf "  ${DIM}  %s${RST}\n" "$errline"
      done
      printf "  ${RED}%s${RST}\n" "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      printf '\n'
    fi
  fi

  rm -rf "$TMPDIR_DEPLOY" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 1' INT TERM

# ── URL display ────────────────────────────────────────────────────────────────
display_urls() {
  printf '\n'
  printf "  ${BLD}Deployment URLs${RST}\n"
  printf "  ${DIM}────────────────────────────────────────${RST}\n"

  if $DEPLOY_BACKEND; then
    local backend_url
    backend_url=$(gcloud run services describe "$BACKEND_SERVICE" \
      --region "$REGION" --project "$PROJECT_ID" \
      --format='value(status.url)' 2>/dev/null) || backend_url="(unable to retrieve)"
    printf "  ${GRN}Backend:${RST}  %s\n" "$backend_url"
  fi

  if $DEPLOY_FRONTEND; then
    local frontend_url
    frontend_url=$(gcloud run services describe "$FRONTEND_SERVICE" \
      --region "$REGION" --project "$PROJECT_ID" \
      --format='value(status.url)' 2>/dev/null) || frontend_url="(unable to retrieve)"
    printf "  ${GRN}Frontend:${RST} %s\n" "$frontend_url"
  fi
  printf '\n'
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────
preflight() {
  printf "\n  ${BLD}Pre-flight checks${RST}\n"
  local ok=true

  if command -v gcloud &>/dev/null; then
    log_success "gcloud CLI found"
  else
    log_error "gcloud CLI not found in PATH"
    ok=false
  fi

  if gcloud auth print-identity-token &>/dev/null 2>&1; then
    log_success "GCP authentication valid"
  else
    log_error "Not authenticated -- run: gcloud auth login"
    ok=false
  fi

  if $DEPLOY_BACKEND && [[ ! -d "$SCRIPT_DIR/backend" ]]; then
    log_error "backend/ directory not found"
    ok=false
  fi

  if $DEPLOY_FRONTEND && [[ ! -d "$SCRIPT_DIR/frontend" ]]; then
    log_error "frontend/ directory not found"
    ok=false
  fi

  if ! $ok; then
    printf '\n'
    log_error "Pre-flight checks failed -- aborting"
    exit 1
  fi
  printf '\n'
}

# ── Help ───────────────────────────────────────────────────────────────────────
show_help() {
  cat <<'HELP'

  Usage: ./deploy.sh [backend] [frontend] [-h|--help]

  Deploy the Email Composer app (FastAPI + Angular) to Google Cloud Run.
  Backend uses Cloud SQL (Postgres via asyncpg) + BigQuery vector search + Vertex AI.

  Required env vars for backend deploy:
    DB_PASS             Cloud SQL postgres password (REQUIRED)

  Optional overrides:
    PROJECT_ID          default: gtm-cloud-helpdesk
    REGION              default: us-central1
    CLOUD_SQL_INSTANCE  default: \${PROJECT_ID}:\${REGION}:email-composer-db
    DB_USER             default: postgres
    DB_NAME             default: email_composer
    BQ_DATASET          default: email_composer_vectors
    BQ_TABLE            default: canned_responses

  Prereqs (run once per GCP project):
    1. gcloud auth login
    2. Create the Cloud SQL Postgres instance: CLOUD_SQL_INSTANCE
    3. Create database DB_NAME inside that instance
    4. Create BigQuery dataset BQ_DATASET (us-central1)
    5. Create BQ table with schema:
         id STRING, category STRING, description STRING, response STRING,
         document STRING, embedding ARRAY<FLOAT64>
       then create a vector index on 'embedding' (optional but recommended)
    6. Grant the Cloud Run service account:
         roles/cloudsql.client
         roles/aiplatform.user
         roles/bigquery.dataEditor
         roles/bigquery.jobUser

  Arguments:
    backend     Deploy only the backend service
    frontend    Deploy only the frontend service
    (none)      Deploy both backend and frontend

  Options:
    -h, --help  Show this help message

HELP
}

# ── Argument parsing ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    backend)   DEPLOY_BACKEND=true ;;
    frontend)  DEPLOY_FRONTEND=true ;;
    -h|--help) show_help; exit 0 ;;
    *)         log_error "Unknown argument: $1"; show_help; exit 1 ;;
  esac
  shift
done

if ! $DEPLOY_BACKEND && ! $DEPLOY_FRONTEND; then
  DEPLOY_BACKEND=true
  DEPLOY_FRONTEND=true
fi

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  preflight
  build_phase_list
  setup_ui

  # ── Backend ──
  if $DEPLOY_BACKEND; then
    if [[ -z "$DB_PASS" ]]; then
      log_error "DB_PASS env var is required — export DB_PASS=... before running"
      exit 1
    fi

    run_phase "Build backend image" \
      gcloud builds submit \
        --tag "$BACKEND_IMAGE" \
        --project "$PROJECT_ID" \
        "$SCRIPT_DIR/backend"

    local database_url="postgresql://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${CLOUD_SQL_INSTANCE}"

    run_phase "Deploy backend to Cloud Run" \
      gcloud run deploy "$BACKEND_SERVICE" \
        --image "$BACKEND_IMAGE" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --allow-unauthenticated \
        --add-cloudsql-instances "$CLOUD_SQL_INSTANCE" \
        --set-env-vars "DATABASE_URL=${database_url},GCP_PROJECT_ID=${PROJECT_ID},BQ_DATASET=${BQ_DATASET},BQ_TABLE=${BQ_TABLE},EMBEDDING_LOCATION=${REGION}" \
        --quiet
  fi

  # ── Frontend ──
  if $DEPLOY_FRONTEND; then
    run_phase "Build frontend image" \
      gcloud builds submit \
        --config "$SCRIPT_DIR/frontend/cloudbuild.yaml" \
        --project "$PROJECT_ID" \
        --substitutions="_BACKEND_URL=${BACKEND_URL}" \
        "$SCRIPT_DIR/frontend"

    run_phase "Deploy frontend to Cloud Run" \
      gcloud run deploy "$FRONTEND_SERVICE" \
        --image "$FRONTEND_IMAGE" \
        --region "$REGION" \
        --project "$PROJECT_ID" \
        --allow-unauthenticated \
        --quiet
  fi

  teardown_ui
  display_urls
  log_success "Deployment complete"
  printf '\n'
}

main
