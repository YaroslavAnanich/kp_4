from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum

from src.core.schemes import MediaType


class MessageSchema(BaseModel):
    """Схема для представления сообщения с детальной информацией о медиа."""
    id: int = Field(..., description="Уникальный идентификатор сообщения (ID)")
    tg_chat_id: int
    text: Optional[str] = Field(None, description="Текст сообщения")
    sender_name: Optional[str] = Field(None, description="Имя отправителя сообщения")
    media_type: Optional[MediaType] = Field(None, description="Тип медиа-контента")
    file_name: Optional[str] = Field(None, description="Имя файла, если применимо")
    file_path: Optional[str] = Field(None)
    photo_base64: Optional[str] = Field(None)

