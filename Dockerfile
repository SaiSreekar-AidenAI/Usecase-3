# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
ENV REACT_APP_API_BASE=
RUN npm run build

# Stage 2: Python backend + frontend static files
FROM python:3.12-slim

WORKDIR /app

# Install system deps for asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy backend code
COPY backend/main.py ./
COPY backend/app/ ./app/

# Copy Excel data file
COPY backend/Canned_Responses_Templatefull.xlsx /data/Canned_Responses_Templatefull.xlsx

# Copy frontend build
COPY --from=frontend-build /app/build /app/frontend-build

ENV PORT=8080
ENV ENV=production
ENV EXCEL_DATA_PATH=/data/Canned_Responses_Templatefull.xlsx

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
