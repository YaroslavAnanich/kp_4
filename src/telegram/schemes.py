from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum

class MediaType(str, Enum):
    PHOTO = "photo"
    VIDEO = "video"
    AUDIO = "audio"
    STICKER = "sticker"
    GIF = "gif"
    DOCUMENT = "document"
    LINK = "link"
    UNKNOWN = "unknown"

class ChatSchema(BaseModel):
    """Схема для представления информации о чате/диалоге."""
    id: int = Field(..., description="Уникальный идентификатор чата (ID)")
    name: str = Field(..., description="Название чата/диалога")
    icon_photo_base64: Optional[str] = Field(None, description="Иконка чата в формате base64")

class MessageSchema(BaseModel):
    """Схема для представления сообщения с детальной информацией о медиа."""
    id: int = Field(..., description="Уникальный идентификатор сообщения (ID)")
    tg_chat_id: int
    text: Optional[str] = Field(None, description="Текст сообщения")
    sender_name: Optional[str] = Field(None, description="Имя отправителя сообщения")
    media_type: Optional[MediaType] = Field(None, description="Тип медиа-контента")
    file_name: Optional[str] = Field(None, description="Имя файла, если применимо")