FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir fastapi uvicorn[standard] psycopg2-binary sqlalchemy pydantic

COPY backend /app/backend
COPY web /app/web
COPY print_agent /app/print_agent

WORKDIR /app/backend
EXPOSE 8765

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8765"]
