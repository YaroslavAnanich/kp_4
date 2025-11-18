from io import BytesIO
from typing import List, Optional
from telethon import TelegramClient
from telethon.tl.types import (Dialog, Message, User, MessageMediaPhoto, MessageMediaDocument, Document,
                               MessageMediaWebPage)

from src.core.utils.file_util import FileUtil
from src.notion.schemes import AnyBlock, TextBlock, LinkBlock, FileBlock
from src.telegram.schemes import ChatSchema, MessageSchema, MediaType
import base64


class TelegramService:
    """Сервис для взаимодействия с Telegram API через Telethon, с использованием Pydantic схем."""

    def __init__(self, api_id: int, api_hash: str, session_name: str = 'session'):
        self.api_id = api_id
        self.api_hash = api_hash
        self.session_name = session_name
        self.client = None
        self.file_util = FileUtil()

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

    async def _download_file_by_message_id(self, chat_id: int, message_id: int) -> Optional[bytes]:
        """Скачивает файл из Telegram по ID сообщения."""
        await self._ensure_client()

        try:
            # Получаем сообщение по ID
            telegram_message = await self.client.get_messages(
                entity=chat_id,
                ids=message_id
            )

            if not telegram_message or not telegram_message.media:
                return None

            # Скачиваем файл в память
            file_bytes = await self.client.download_media(
                telegram_message,
                file=bytes
            )

            return file_bytes

        except Exception as e:
            # Логируем ошибку, если нужно
            print(f"Ошибка при загрузке файла: {e}")
            return None

    async def _to_chat_schema(self, dialog: Dialog) -> ChatSchema:
        entity = dialog.entity

        name = dialog.name or "unknown"

        icon_photo_base64 = None
        if hasattr(entity, 'photo') and entity.photo:
            photo_bytes = await self.client.download_profile_photo(entity, file=bytes)
            if photo_bytes:
                icon_photo_base64 = base64.b64encode(photo_bytes).decode('utf-8')

        return ChatSchema(
            id=entity.id,
            name=name,
            icon_photo_base64=icon_photo_base64
        )

    def _get_media_info(self, message: Message) -> dict:
        if not message.media:
            return {"media_type": None, "file_name": None}

        media_type = MediaType.UNKNOWN
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

        return MessageSchema(
            id=message.id,
            tg_chat_id=message.chat_id,
            text=text,
            sender_name=sender_name,
            media_type=media_info.get("media_type"),
            file_name=media_info.get("file_name")
        )

    async def get_all_chats(self) -> List[ChatSchema]:
        await self._ensure_client()

        dialogs = await self.client.get_dialogs()
        chats: List[ChatSchema] = []

        for dialog in dialogs:
            chat_data = await self._to_chat_schema(dialog)
            chats.append(chat_data)

        return chats

    async def get_messages_from_chat(self, chat_id: int, limit: int = 100) -> List[MessageSchema]:
        await self._ensure_client()

        messages = await self.client.get_messages(chat_id, limit=limit)
        chat: List[MessageSchema] = []

        for message in messages:
            message_data = await self._to_message_schema(message)
            chat.append(message_data)
        chat.reverse()
        return chat



    # async def message_to_block(self, message: MessageSchema) -> AnyBlock:
    #     """Преобразует MessageSchema в соответствующий блок контента."""

    #     # Если нет медиа - возвращаем текстовый блок
    #     if message.media_type is None:
    #         text_span = TextSpan(text=f'{message.sender_name} написал: {message.text}' or "")
    #         return TextBlock(content=[text_span])

    #     # Если это ссылка - возвращаем LinkBlock
    #     elif message.media_type == MediaType.LINK:
    #         return LinkBlock(content=message.text or "")

    #     # Для всех остальных типов медиа - FileBlock
    #     else:
    #         # Скачиваем файл из Telegram
    #         file_bytes = await self._download_file_by_message_id(
    #             chat_id=message.tg_chat_id,
    #             message_id=message.id
    #         )

    #         if not file_bytes:
    #             # Если не удалось скачать, возвращаем текстовый блок
    #             text_span = TextSpan(text=f"[Ошибка загрузки: {message.file_name or 'unknown'}]")
    #             return TextBlock(content=[text_span])

    #         # Сохраняем файл через FileUtil



    #         # Создаем файловый объект из байтов
    #         file_obj = BytesIO(file_bytes)
    #         print("я дошел до этого момента")
    #         print(file_obj)
    #         # Сохраняем файл
    #         server_name = self.file_util.save_file(file_obj)
    #         print(server_name)

    #         return FileBlock(
    #             file_name=message.file_name or "unknown_file",
    #             file_path=server_name,
    #             media_type=message.media_type
    #         )

    async def chat_to_blocks(self, chat_id: int, limit: int = 100) -> List[AnyBlock]:
        """Получить все сообщения из чата и преобразовать в блоки с нумерацией."""

        messages = await self.get_messages_from_chat(chat_id, limit)
        blocks = []

        order = 1
        for message in messages:
            block = await self.message_to_block(message)
            block.order = order
            blocks.append(block)
            order += 1

        return blocks

    async def disconnect(self):
        if self.client:
            await self.client.disconnect()

