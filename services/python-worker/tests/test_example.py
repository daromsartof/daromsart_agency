import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def test_echo_without_api_key_configured(client: TestClient):
    response = client.post("/v1/echo", json={"message": "bonjour"})
    assert response.status_code == 200
    assert response.json() == {"message": "bonjour", "length": 7}


def test_echo_with_blank_api_key_env_var_is_disabled(monkeypatch: pytest.MonkeyPatch):
    # WORKER_API_KEY="" (défaut de .env.example) doit désactiver l'auth, pas
    # exiger une clé vide — sinon toute requête sans clé échoue silencieusement.
    monkeypatch.setenv("WORKER_API_KEY", "")
    get_settings.cache_clear()
    client = TestClient(app)

    response = client.post("/v1/echo", json={"message": "bonjour"})
    assert response.status_code == 200

    get_settings.cache_clear()


def test_echo_requires_api_key_when_configured(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("WORKER_API_KEY", "secret-key")
    get_settings.cache_clear()
    client = TestClient(app)

    unauthorized = client.post("/v1/echo", json={"message": "bonjour"})
    assert unauthorized.status_code == 401

    authorized = client.post(
        "/v1/echo", json={"message": "bonjour"}, headers={"X-API-Key": "secret-key"}
    )
    assert authorized.status_code == 200

    get_settings.cache_clear()
