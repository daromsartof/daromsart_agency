# python-worker

Modèle de référence pour les workers Python du monorepo (voir la section
« Workers Python (REST API) » du [README racine](../../README.md) pour
l'architecture, le déploiement Docker et le guide de duplication).

## Dev

```bash
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Docs interactives : `http://localhost:8000/docs`.

## Tests / lint

```bash
uv run pytest
uv run ruff check .
```

## Structure

```
app/
  main.py       # instance FastAPI, routes système (/health)
  config.py     # Settings (variables WORKER_*)
  security.py   # dépendance require_api_key (header X-API-Key)
  routers/
    example.py  # exemple de route protégée — à remplacer par la vraie logique
tests/
```
