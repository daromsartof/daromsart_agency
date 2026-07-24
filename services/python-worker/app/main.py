from fastapi import FastAPI

from app.routers import example

app = FastAPI(
    title="Daromsart python-worker",
    description="Modèle de worker Python (REST API) du monorepo daromsart_agency.",
    version="0.1.0",
)

app.include_router(example.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Sans authentification — utilisé par le HEALTHCHECK Docker et les sondes externes."""
    return {"status": "ok"}
