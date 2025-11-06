from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from src.core.config import DSN

# Создание движка базы данных
engine = create_engine(url=DSN)

# Создание сессии
session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Базовый класс для моделей
class Base(DeclarativeBase):
    pass

Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)