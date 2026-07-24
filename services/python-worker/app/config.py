from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    """Configuration du worker, lue depuis l'environnement (voir .env.example)."""

    model_config = SettingsConfigDict(env_prefix="WORKER_", extra="ignore")

    # Si vide/absente : l'authentification par clé API est désactivée (dev
    # local uniquement). En prod/self-hosted, toujours renseigner WORKER_API_KEY.
    api_key: str | None = None

    @field_validator("api_key")
    @classmethod
    def _blank_key_means_disabled(cls, value: str | None) -> str | None:
        # WORKER_API_KEY="" (chaîne vide, ex. .env.example par défaut) doit
        # désactiver l'auth comme une variable absente, pas exiger une clé vide.
        return value or None


@lru_cache
def get_settings() -> Settings:
    return Settings()
