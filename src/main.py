from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.api import main_router

app = FastAPI()

app.include_router(main_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем все источники (для тестирования)
    allow_credentials=True,  # Разрешаем отправку cookies
    allow_methods=["*"],  # Разрешаем все HTTP-методы
    allow_headers=["*"]  # Разрешаем все заголовки
)