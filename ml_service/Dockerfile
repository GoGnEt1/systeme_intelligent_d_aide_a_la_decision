# =============================================================
#  Dockerfile — FastAPI ML Service
#  Python 3.11.9 — stable pour scikit-learn, Prophet, Surprise
# =============================================================

FROM python:3.11.9-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dépendances système (libpq pour psycopg2, gcc pour scikit-surprise)
RUN apt-get update && apt-get install -y \
    libpq-dev \
    build-essential \
    gcc \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Ordre d'installation critique :
# 1. numpy     — requis au build par scikit-surprise et pyarrow
# 2. pyarrow   — requis par pandas.read_parquet() (products.parquet)
# 3. le reste  — inclut tensorflow-cpu, scikit-surprise, prophet
RUN pip install --no-cache-dir --upgrade "pip<25" \
    && pip install --no-cache-dir numpy==1.26.4 \
    && pip install --no-cache-dir pyarrow==14.0.2 \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001
