from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.config import Settings, get_settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(
    provided_key: str | None = Security(_api_key_header),
    settings: Settings = Depends(get_settings),
) -> None:
    """Protège une route avec la clé API du worker (header `X-API-Key`).

    Si `WORKER_API_KEY` n'est pas configuré, l'authentification est
    désactivée — pratique en dev local, à toujours configurer en prod.
    """
    if settings.api_key is None:
        return
    if provided_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Clé API invalide ou manquante (header X-API-Key).",
        )
