# src/core/dependencies.py
from src.core.utils.file_util import FileUtil
from src.llm.service import LlmService
from src.notion.service import NotionService
from src.telegram.service import TelegramService
from src.telegram.config import telegram_settings
from src.core.database import engine, session_factory
from functools import lru_cache
from telethon import TelegramClient


_telegram_client = TelegramClient('session', telegram_settings.TG_API_ID, telegram_settings.TG_API_HASH)
_llm_service = LlmService()
_notion_service = NotionService()
_telegram_service = TelegramService(_telegram_client)
_file_util = FileUtil()

@lru_cache(maxsize=1)
def get_llm_service() -> LlmService:
    return _llm_service

@lru_cache(maxsize=1)
def get_notion_service() -> NotionService:
    return _notion_service

@lru_cache(maxsize=1)
def get_telegram_service() -> TelegramService:
    return _telegram_service

@lru_cache(maxsize=1)
def get_file_util() -> FileUtil:
    return _file_util