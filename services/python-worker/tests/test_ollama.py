import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app

# Port local fermé → httpx.ConnectError immédiat (pas de timeout) : simule
# Ollama non démarré. Le proxy doit répondre 502 lisible, jamais planter.
CLOSED = "http://127.0.0.1:59999"


def test_models_502_when_ollama_down(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("WORKER_OLLAMA_BASE_URL", CLOSED)
    get_settings.cache_clear()
    client = TestClient(app)
    response = client.get("/v1/models")
    assert response.status_code == 502
    assert "Ollama" in response.json()["error"]
    get_settings.cache_clear()


def test_chat_completions_502_when_ollama_down(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("WORKER_OLLAMA_BASE_URL", CLOSED)
    get_settings.cache_clear()
    client = TestClient(app)
    response = client.post("/v1/chat/completions", json={"model": "llama3.1", "messages": []})
    assert response.status_code == 502
    get_settings.cache_clear()
