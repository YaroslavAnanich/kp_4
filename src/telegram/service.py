import io
from typing import BinaryIO, List, Optional
from telethon import TelegramClient
from telethon.tl.types import (Dialog, Message, User, MessageMediaPhoto, MessageMediaDocument, Document,
                               MessageMediaWebPage)
from src.core.database import engine, session_factory
from src.core.schemes import MediaType
from src.core.utils.file_util import FileUtil
from src.notion.schemes import AnyBlock, TextBlock, LinkBlock, FileBlock
from src.telegram.models import TelegramChatOrm
from src.telegram.schemes import MessageSchema
from src.telegram.mysql import TelegramMysql
import base64


class TelegramService:
    """Сервис для взаимодействия с Telegram API через Telethon, с использованием Pydantic схем."""

    def __init__(self, api_id: int, api_hash: str, session_name: str = 'session'):
        self.api_id = api_id
        self.api_hash = api_hash
        self.session_name = session_name
        self.client = None
        self.file_util = FileUtil()
        self.mysql = TelegramMysql(engine=engine, session_factory=session_factory)

    async def __aenter__(self):
        await self._ensure_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.disconnect()

    async def _ensure_client(self):
        if self.client is None:
            self.client = TelegramClient(self.session_name, self.api_id, self.api_hash)
            await self.client.start()

    async def _download_file_by_message_id(self, telegram_chat_id: int, message_id: int) -> Optional[io.BytesIO]:
        """Скачивает файл из Telegram по ID сообщения."""
        await self._ensure_client()

        try:            
            telegram_message = await self.client.get_messages(
                entity=telegram_chat_id,
                ids=message_id
            )

            if not telegram_message:
                return None
                
            if not telegram_message.media:
                return None


            file_bytes = await self.client.download_media(
                telegram_message,
                file=bytes
            )
            
            return io.BytesIO(file_bytes)
        except Exception as e:
            # Логируем ошибку, если нужно
            print(f"Ошибка при загрузке файла: {e}")
            import traceback
            traceback.print_exc()
            return None
        
        
        
    async def _download_media_to_base64(self, message: Message) -> Optional[str]:
        """Скачивает медиа из сообщения и возвращает в формате base64."""
        if not message.media:
            return None
            
        try:
            # Скачиваем медиа в память
            file_bytes = await self.client.download_media(
                message.media,
                file=bytes
            )
            
            if file_bytes:
                # Кодируем в base64
                return base64.b64encode(file_bytes).decode('utf-8')
                
        except Exception as e:
            print(f"Ошибка при загрузке медиа для сообщения {message.id}: {e}")
        
        return None

    def _get_media_info(self, message: Message) -> dict:
        if not message.media:
            return {"media_type": None, "file_name": None}

        media_type = None
        file_name = None

        if isinstance(message.media, MessageMediaPhoto):
            media_type = MediaType.PHOTO

        elif isinstance(message.media, MessageMediaWebPage):
            media_type = MediaType.LINK

        elif isinstance(message.media, MessageMediaDocument):
            document = message.media.document
            if isinstance(document, Document):
                mime_type = getattr(document, 'mime_type', None)
                if mime_type and mime_type.startswith('image/'):
                    media_type = MediaType.PHOTO
                else:
                    media_type = MediaType.DOCUMENT

                for attr in document.attributes:
                    attr_name = type(attr).__name__
                    if 'Audio' in attr_name:
                        media_type = MediaType.AUDIO
                    elif 'Sticker' in attr_name:
                        media_type = MediaType.PHOTO
                    elif 'Animated' in attr_name or 'Gif' in attr_name:
                        media_type = MediaType.PHOTO

                for attr in document.attributes:
                    if hasattr(attr, 'file_name') and attr.file_name:
                        file_name = attr.file_name
                        break
                    else:
                        file_name = "unknown_file"

        return {"media_type": media_type, "file_name": file_name}

    async def _to_message_schema(self, message: Message) -> MessageSchema:
        sender = await message.get_sender()
        if isinstance(sender, User):
            sender_name = sender.first_name
            if sender.last_name:
                sender_name += f" {sender.last_name}"
        else:
            sender_name = sender.title

        media_info = self._get_media_info(message)

        text = message.text

        # Инициализируем photo_base64 как None
        photo_base64 = None
        
        # Если тип медиа - фото, загружаем его в base64
        if media_info.get("media_type") == MediaType.PHOTO:
            photo_base64 = await self._download_media_to_base64(message)

        return MessageSchema(
            id=message.id,
            tg_chat_id=message.chat_id,
            text=text,
            sender_name=sender_name,
            media_type=media_info.get("media_type"),
            file_name=media_info.get("file_name"),
            photo_base64=photo_base64  # Добавляем поле с фото в base64
        )

    async def get_all_chats(self) -> List[TelegramChatOrm]:
        # Пытаемся получить чаты из MySQL
        chats = self.mysql.get_all_chats()
        
        # Если в MySQL есть чаты, возвращаем их
        if chats:
            return chats
        
        # Если чатов нет, загружаем их из Telegram
        await self._load_chats_from_telegram()
        
        # Возвращаем обновленный список чатов из MySQL
        return self.mysql.get_all_chats()

    async def _load_chats_from_telegram(self):
        """Загружает чаты из Telegram и сохраняет их в MySQL с иконками."""
        await self._ensure_client()
        dialogs = await self.client.get_dialogs()
        
        for dialog in dialogs:
            if dialog.is_user or dialog.is_group or dialog.is_channel:
                # Получаем информацию о чате для иконки
                file = await self._download_chat_icon(dialog)
                file_name = f"chat_icon_{dialog.id}.jpg"
                
                # Сохраняем иконку и получаем путь
                if file:
                    filename, file_path = self.file_util.save_file(
                        file=file, 
                        path="icons", 
                        filename=file_name
                    )
                else:
                    file_path = None
                
                # Добавляем чат в MySQL
                self.mysql.add_telegram_chat(
                    tg_chat_id=dialog.id,
                    name=dialog.name,
                    file_path=file_path
                )

    async def _download_chat_icon(self, dialog: Dialog) -> Optional[BinaryIO]:
        """Скачивает иконку чата/диалога."""
        try:
            entity = dialog.entity
            
            # Пытаемся скачать фото профиля/чата
            if hasattr(entity, 'photo') and entity.photo:
                # Скачиваем фото в память
                file_bytes = await self.client.download_profile_photo(
                    entity,
                    file=bytes
                )
                if file_bytes:
                    return io.BytesIO(file_bytes)
            
            # Для пользователей можно попробовать скачать аватар
            elif hasattr(entity, 'first_name') or hasattr(entity, 'title'):
                try:
                    file_bytes = await self.client.download_profile_photo(
                        entity,
                        file=bytes
                    )
                    if file_bytes:
                        return io.BytesIO(file_bytes)
                except Exception as e:
                    print(f"Не удалось скачать иконку для {entity.id}: {e}")
                    
        except Exception as e:
            print(f"Ошибка при загрузке иконки чата: {e}")
        
        return None


    async def get_messages_from_chat(self, chat_id: int, offset_id: int = 0, limit: int = 20) -> List[MessageSchema]:
        await self._ensure_client()

        # Получаем кэш для этого телеграм чата
        telegram_chat = self.mysql.get_telegram_chat_by_id(chat_id=chat_id)
        cache_records = []
        if telegram_chat:
            cache_records = self.mysql.get_cache_by_telegram_chat_id(telegram_chat.telegram_chat_id)
        
        # Создаем словарь для быстрого поиска кэша по telegram_message_id
        cache_dict = {cache.telegram_message_id: cache.file_path for cache in cache_records}

        # Правильная пагинация: загружаем только нужные сообщения
        # add_offset - смещение от последнего сообщения
        messages = await self.client.get_messages(
            telegram_chat.telegram_chat_id, 
            limit=limit,
            offset_id=offset_id  # ID сообщения, от которого считать offset
        )
        
        chat: List[MessageSchema] = []

        for message in messages:
            message_data = await self._to_message_schema(message)
            
            # Проверяем есть ли кэш для этого сообщения
            if message.id in cache_dict:
                message_data.file_path = cache_dict[message.id]
            
            chat.append(message_data)
        
        # Если нужны сообщения в хронологическом порядке (старые -> новые)
        chat.reverse()
        return chat

    async def add_to_cache(self, chat_id: int, message_id: int, file_name):
        telegram_chat = self.mysql.get_telegram_chat_by_id(chat_id=chat_id)
        file = await self._download_file_by_message_id(telegram_chat_id=telegram_chat.telegram_chat_id, message_id=message_id)
        filename, file_path = self.file_util.save_file(file=file, path="cache" , filename=file_name) 
        self.mysql.add_telegram_cache(chat_id=chat_id, telegram_message_id=message_id, file_path=file_path)
        return file_path

    async def disconnect(self):
        if self.client:
            await self.client.disconnect()

