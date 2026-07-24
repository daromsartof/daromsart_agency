# syntax=docker/dockerfile:1
#
# Image de production pour le worker python-worker (FastAPI + uv).
# Contexte de build = RACINE du monorepo (comme les apps Next.js) :
#   docker build -f services/python-worker/Dockerfile -t python-worker .
#
# Pour créer un NOUVEAU worker Python : dupliquer services/python-worker/,
# copier ce Dockerfile dans services/<nouveau-worker>/ et adapter PROJECT_PATH
# ci-dessous (aucune autre modification n'est nécessaire).

ARG PYTHON_VERSION=3.12-slim-bookworm
ARG PROJECT_PATH=services/python-worker

# ── 1) Builder : installe les dépendances via uv dans un venv isolé ────────
FROM python:${PYTHON_VERSION} AS builder
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /uvx /bin/
ARG PROJECT_PATH
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/app/.venv

# a) Manifests seuls d'abord : la couche d'install ne casse que si les
#    dépendances changent (le code applicatif change plus souvent).
COPY ${PROJECT_PATH}/pyproject.toml ${PROJECT_PATH}/uv.lock ${PROJECT_PATH}/.python-version ./
RUN uv sync --locked --no-dev

# ── 2) Runner minimal : venv + code applicatif uniquement ──────────────────
FROM python:${PYTHON_VERSION} AS runner
ARG PROJECT_PATH
WORKDIR /app
ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Utilisateur non-root
RUN addgroup --system --gid 1001 worker \
  && adduser --system --uid 1001 --ingroup worker worker

COPY --from=builder --chown=worker:worker /app/.venv ./.venv
COPY --chown=worker:worker ${PROJECT_PATH}/app ./app

USER worker
EXPOSE 8000

# Vérification de vie simple (pas de dépendance à curl).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os,sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/health', timeout=3).status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
