from fastapi import FastAPI

from app.routers import example, ollama

app = FastAPI(
    title="Daromsart python-worker",
    description="Modèle de worker Python (REST API) du monorepo daromsart_agency.",
    version="0.1.0",
)

app.include_router(example.router)
# Proxy LLM local (Ollama/GPU) — 4ᵉ provider du mode agent.
app.include_router(ollama.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Sans authentification — utilisé par le HEALTHCHECK Docker et les sondes externes."""
    return {"status": "ok"}
