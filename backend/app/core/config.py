from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment variables from docs/api_contract.md section 7."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The checked-in dataset is the California/US ACN source of truth.
    # Legacy contract examples remain available only when MOCK=1 is explicit.
    mock: bool = False
    data_dir: str = "./data"
    cors_origins: str = "http://localhost:5173"
    llm_api_key: str = ""
    llm_model: str = ""
    firebase_credentials: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def llm_configured(self) -> bool:
        return bool(self.llm_api_key and self.llm_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
