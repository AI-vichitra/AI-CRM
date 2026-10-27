import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

# Explicitly load .env from the backend root folder using absolute path
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.environ.get("DATA_DIR", base_dir)
try:
    os.makedirs(data_dir, exist_ok=True)
except Exception:
    pass

env_path = os.path.join(base_dir, ".env")
load_dotenv(dotenv_path=env_path, override=False)

# Seed config_store.json to data_dir if needed
if data_dir != base_dir:
    target_cfg = os.path.join(data_dir, "config_store.json")
    if not os.path.exists(target_cfg):
        src_cfg = os.path.join(base_dir, "config_store.json")
        if os.path.exists(src_cfg):
            try:
                import shutil
                shutil.copy2(src_cfg, target_cfg)
            except Exception:
                pass


class Settings(BaseSettings):
    google_credentials_json: Optional[str] = None
    google_api_key: Optional[str] = None
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    config_store_path: str = os.environ.get("CONFIG_STORE_PATH", os.path.join(data_dir, "config_store.json"))
    cors_origins: List[str] = ["http://localhost:3000"]
    cache_ttl_seconds: int = 60
    
    # SMTP Settings
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = "aryan@cogculture.agency"
    smtp_password: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
# Reload trigger
