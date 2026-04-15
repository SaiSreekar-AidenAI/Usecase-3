FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY main.py ./
COPY app/ ./app/
COPY Canned_Responses_Templatefull.xlsx /data/Canned_Responses_Templatefull.xlsx

ENV PORT=8080
ENV EXCEL_DATA_PATH=/data/Canned_Responses_Templatefull.xlsx

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
