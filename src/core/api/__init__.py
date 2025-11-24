from fastapi import APIRouter

from src.llm.router import router as llm_router
from src.telegram.router import router as telegram_router
from src.notion.router import router as notion_router


main_router = APIRouter()

main_router.include_router(telegram_router)
main_router.include_router(llm_router)

main_router.include_router(notion_router)


