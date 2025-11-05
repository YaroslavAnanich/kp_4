from fastapi import Depends, APIRouter

from src.telegram.schemes import MessageSchema
from src.telegram.service import TelegramService
from src.telegram.config import settings

router = APIRouter(prefix="/api/telegram")

service = TelegramService(api_hash=settings.TG_API_HASH, api_id=settings.TG_API_ID)



@router.get("/chats", summary="Получить все чаты пользователя")
async def get_all_user_chats():
    chats = await service.get_all_chats()
    return {'chats': chats}



@router.get("/chats/{chat_id}", summary="Получить сообщения из чата")
async def get_chat_messages(
    chat_id: int,
    limit: int
):
    messages = await service.get_messages_from_chat(chat_id, limit)
    return {'messages': messages}

@router.post("/get-block", summary="Получить все чаты пользователя")
async def get_all_user_chats(message: MessageSchema):
    block = await service.message_to_block(message)
    return {'block': block}