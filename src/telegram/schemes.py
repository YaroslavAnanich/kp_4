from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum

from src.core.schemes import MediaType


class MessageSchema(BaseModel):
    id: int
    tg_chat_id: int
    text: Optional[str] = None
    sender_name: str
    sender_id: Optional[int] = None
    media_type: Optional[MediaType] = None
    file_name: Optional[str] = None
    file_path: Optional[str] = None
    photo_base64: Optional[str] = None
    is_outgoing: bool = False  # ← КЛЮЧЕВОЕ ПОЛЕ

class SendMessageSchema(BaseModel):
    text: str