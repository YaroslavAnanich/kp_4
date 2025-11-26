from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from src.core.api import main_router
from src.core.database import Base, engine
from src.core.dependencies import get_telegram_service


app = FastAPI()


app.include_router(main_router)

@app.on_event("startup")
async def startup_event():
    service = get_telegram_service()
    await service.client.start()        # ← авторизация + подключение
    await service.start_listener()      # ← ВКЛЮЧАЕТ СЛУШАТЕЛЬ СОБЫТИЙ!
    print("Telegram listener started")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Base.metadata.drop_all(engine)
# Base.metadata.create_all(engine)

