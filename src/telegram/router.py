from fastapi import Depends, APIRouter, Query
from functools import lru_cache
from src.notion.router import get_notion_service
from src.notion.notion_service import NotionService
from src.telegram.schemes import MessageSchema
from src.telegram.telegram_service import TelegramService
from src.telegram.config import telegram_settings

router = APIRouter(tags=["telegram"])

@lru_cache(maxsize=1)
def get_telegram_service() -> TelegramService:
    return TelegramService(api_hash=telegram_settings.TG_API_HASH, api_id=telegram_settings.TG_API_ID)

@router.get("/tg/chats")
async def get_all_user_chats(service: TelegramService = Depends(get_telegram_service)):
    chats = await service.get_all_chats()
    return {'chats': chats}

@router.get("/tg/chats/{chat_id}/messages")
async def get_chat_messages(
    chat_id: int,
    limit: int,
    service: TelegramService = Depends(get_telegram_service)
):
    messages = await service.get_messages_from_chat(chat_id, limit)
    return {'messages': messages}

@router.post("/tg/chats/{chat_id}/collection")
async def create_collection_from_chat(
    chat_id: int,
    limit: int,
    notion_service: NotionService = Depends(get_notion_service),
    tg_service: TelegramService = Depends(get_telegram_service)
):
    collection = await notion_service.create_collection()
    blocks = await tg_service.chat_to_blocks(chat_id, limit)
    for block in blocks:
        await notion_service.add_block(collection.qdrant_id, block)
    return {'collection_name': collection.qdrant_id}


@router.post("/tg/messages/blocks")
async def message_to_block(message: MessageSchema, service: TelegramService = Depends(get_telegram_service)):
    return await service.message_to_block(message=message)