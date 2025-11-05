from pydantic_settings import BaseSettings

from dotenv import load_dotenv
import os

load_dotenv()  # Загрузка переменных из файла .env

class Settings(BaseSettings):
    TG_API_ID: str = os.getenv("TG_API_ID")
    TG_API_HASH: str = os.getenv("TG_API_HASH")

settings = Settings()