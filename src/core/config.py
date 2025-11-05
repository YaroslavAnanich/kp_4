from pydantic_settings import BaseSettings

from dotenv import load_dotenv
import os

load_dotenv()  # Загрузка переменных из файла .env

class Settings(BaseSettings):
    DB_HOST: str = os.getenv("DB_HOST")
    DB_PORT: int = os.getenv("DB_PORT", 3306)
    DB_USER: str = os.getenv("DB_USER")
    DB_PASS: str = os.getenv("DB_PASS")
    DB_NAME: str = os.getenv("DB_NAME")

settings = Settings()

# Создание строки подключения (DSN)
DSN = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASS}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
