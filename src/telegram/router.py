from fastapi import Depends, APIRouter, Query, Body, WebSocket
from src.telegram.schemes import MessageSchema, SendMessageSchema
from src.telegram.service import TelegramService
from src.core.dependencies import get_telegram_service

router = APIRouter(tags=["telegram"])

@router.get("/tg/chats")
async def get_all_user_chats(service: TelegramService = Depends(get_telegram_service)):
    chats = await service.get_all_chats()
    return {"chats": chats}

@router.get("/tg/chats/{chat_id}/messages")
async def get_chat_messages(
    chat_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset_id: int = Query(default=0),  # 0 = newest
    service: TelegramService = Depends(get_telegram_service)
):
    messages = await service.get_messages_from_chat(
        chat_id=chat_id,
        limit=limit,
        offset_id=offset_id
    )
    return messages

@router.post("/tg/{chat_id}/cache/{message_id}")
async def add_to_cache(
    chat_id: int,
    message_id: int,
    service: TelegramService = Depends(get_telegram_service)
):
    return await service.add_to_cache(chat_id=chat_id, message_id=message_id)

@router.post("/tg/{chat_id}/send")
async def send_message(
    chat_id: int,
    message: SendMessageSchema = Body(...),
    service: TelegramService = Depends(get_telegram_service)
):
    return await service.send_message(chat_id=chat_id, text=message.text)

@router.get("/tg/{chat_id}/{message_id}/block")
async def get_message_as_block(
    chat_id: int,
    message_id: int,
    service: TelegramService = Depends(get_telegram_service)
):
    return await service.get_message_as_block(chat_id=chat_id, message_id=message_id)



@router.websocket("/tg/ws/{chat_id}")
async def websocket_chat(
    websocket: WebSocket,
    chat_id: int,
    service: TelegramService = Depends(get_telegram_service)
):
    await service.connect(websocket, chat_id)
    try:
        while True:
            await websocket.receive_text()
    except:
        pass
    finally:
        await service.disconnect(websocket, chat_id)