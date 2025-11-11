from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from src.core.api import main_router
from src.core.database import Base, engine


app = FastAPI()

app.mount("/var", StaticFiles(directory="var"), name="var")

app.include_router(main_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Base.metadata.drop_all(engine)
# Base.metadata.create_all(engine)
