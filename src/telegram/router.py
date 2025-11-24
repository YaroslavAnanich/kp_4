from fastapi import Depends, APIRouter, Query
from src.notion.service import NotionService
from src.telegram.schemes import MessageSchema
from src.telegram.service import TelegramService
from src.core.dependencies import get_telegram_service

router = APIRouter(tags=["telegram"])



@router.get("/tg/chats")
async def get_all_user_chats(service: TelegramService = Depends(get_telegram_service)):
    chats = await service.get_all_chats()
    return {'chats': chats}

@router.get("/tg/chats/{chat_id}/messages")
async def get_chat_messages(
    chat_id: int,
    limit: int = Query(default=20, ge=1),
    offset_id: int = 0,
    service: TelegramService = Depends(get_telegram_service)
):
    messages = await service.get_messages_from_chat(chat_id=chat_id, offset_id=offset_id, limit=limit)
    return messages

@router.post("/tg/{chat_id}/cache/{message_id}")
async def add_to_cache(
    chat_id: int,
    message_id: int,
    file_name: str,
    service: TelegramService = Depends(get_telegram_service)
):
    return await service.add_to_cache(chat_id=chat_id, message_id=message_id, file_name=file_name)


# @router.post("/tg/messages/blocks")
# async def message_to_block(message: MessageSchema, service: TelegramService = Depends(get_telegram_service)):
#     return await service.message_to_block(message=message)