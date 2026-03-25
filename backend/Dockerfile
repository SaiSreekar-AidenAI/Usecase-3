FROM python:3.12-slim

WORKDIR /app

# Install system deps for asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency file and install
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy application code
COPY main.py ./
COPY app/ ./app/

# Copy Excel data file for first-run ingestion
# Note: Copy Canned_Responses_Templatefull.xlsx into backend/ before building
COPY Canned_Responses_Templatefull.xlsx /data/Canned_Responses_Templatefull.xlsx

ENV PORT=8080
ENV ENV=production
ENV EXCEL_DATA_PATH=/data/Canned_Responses_Templatefull.xlsx

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
