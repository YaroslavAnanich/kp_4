import io
import base64
import os
from typing import BinaryIO, List, Optional, Dict
import cv2
from PIL import Image
import tempfile
import os

from telethon import TelegramClient, events
from telethon.tl.types import (
    Message, User, MessageMediaPhoto, MessageMediaDocument, Document,
    MessageMediaWebPage, PeerUser, PeerChannel, PeerChat
)
from fastapi import WebSocket

from src.core.database import engine, session_factory
from src.core.schemes import MediaType
from src.core.utils.file_util import FileUtil
from src.notion.schemes import Block, FileBlock, LinkBlock, TextBlock
from src.telegram.models import TelegramChatOrm
from src.telegram.schemes import MessageSchema
from src.telegram.mysql import TelegramMysql


class TelegramService:
    def __init__(self, client: TelegramClient):
        self.client = client
        self.file_util = FileUtil()
        self.mysql = TelegramMysql(engine=engine, session_factory=session_factory)
        self.connections: Dict[int, List[WebSocket]] = {}   # ключ — твой внутренний chat.id (например 72)
        self._me = None

    async def __aenter__(self):
        if not self.client.is_connected():
            await self.client.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.disconnect()

    async def start_listener(self):
        if not self.client.is_connected():
            await self.client.connect()

        self.client.add_event_handler(
            self.handle_new_message,
            events.NewMessage(incoming=True, outgoing=True)
        )
        self.client.add_event_handler(
            self.handle_edit_message,
            events.MessageEdited(incoming=True, outgoing=True)
        )
        print("Telegram listener запущен — приходят ВСЕ сообщения (включая свои)")

    async def handle_new_message(self, event: events.NewMessage.Event):
        await self._process_telegram_event(event.message, "new_message")

    async def handle_edit_message(self, event: events.MessageEdited.Event):
        await self._process_telegram_event(event.message, "edit_message")

    async def _process_telegram_event(self, message: Message, event_type: str):
        # Определяем реальный telegram_chat_id
        tg_chat_id = None
        if message.peer_id:
            if isinstance(message.peer_id, PeerUser):
                tg_chat_id = message.peer_id.user_id
            elif isinstance(message.peer_id, PeerChannel):
                tg_chat_id = int(f"-100{message.peer_id.channel_id}")
            elif isinstance(message.peer_id, PeerChat):
                tg_chat_id = message.peer_id.chat_id

        if tg_chat_id is None:
            print(f"[TelegramService] Не удалось определить telegram_chat_id для сообщения {message.id}")
            return

        # Ищем чат по telegram_chat_id (поле в БД!)
        internal_chat = self.mysql.get_chat_by_telegram_id(tg_chat_id)
        if not internal_chat:
            print(f"[TelegramService] Чат с telegram_chat_id={tg_chat_id} не найден в базе")
            return

        schema = await self._to_message_schema(message)
        await self.broadcast(internal_chat.id, {"type": event_type, "message": schema.dict()})
        print(f"→ {event_type} отправлено в UI (chat_id={internal_chat.id}, msg_id={message.id}, outgoing={schema.is_outgoing})")

    async def broadcast(self, internal_chat_id: int, data: dict):
        if internal_chat_id not in self.connections:
            return

        dead = []
        for ws in self.connections[internal_chat_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.connections[internal_chat_id].remove(ws)
        if not self.connections[internal_chat_id]:
            del self.connections[internal_chat_id]

    async def connect(self, websocket: WebSocket, chat_id: int):
        await websocket.accept()
        self.connections.setdefault(chat_id, []).append(websocket)
        print(f"WebSocket подключён к внутреннему chat_id={chat_id}")

    async def disconnect(self, websocket: WebSocket, chat_id: int):
        if chat_id in self.connections and websocket in self.connections[chat_id]:
            self.connections[chat_id].remove(websocket)
            if not self.connections[chat_id]:
                del self.connections[chat_id]
            print(f"WebSocket отключён от chat_id={chat_id}")

    async def get_all_chats(self) -> List[TelegramChatOrm]:
        chats = self.mysql.get_all_chats()
        if chats:
            return chats
        await self._load_chats_from_telegram()
        return self.mysql.get_all_chats()

    async def get_messages_from_chat(
        self,
        chat_id: int,
        limit: int = 20,
        offset_id: int = 0
    ) -> List[MessageSchema]:
        if not self.client.is_connected():
            await self.client.connect()

        telegram_chat = self.mysql.get_telegram_chat_by_id(chat_id=chat_id)
        if not telegram_chat:
            return []

        cache_records = self.mysql.get_cache_by_telegram_chat_id(telegram_chat.telegram_chat_id)  # ← ИСПРАВЛЕНО
        cache_dict = {c.telegram_message_id: c.file_path for c in cache_records}

        messages = await self.client.get_messages(
            entity=telegram_chat.telegram_chat_id,  # ← ИСПРАВЛЕНО
            limit=limit,
            offset_id=offset_id
        )

        result = []
        for message in messages:
            schema = await self._to_message_schema(message)
            if message.id in cache_dict:
                schema.file_path = cache_dict[message.id]
            result.append(schema)
        result.reverse()  # теперь самые новые — внизу
        return result

    async def add_to_cache(self, chat_id: int, message_id: int):
        telegram_chat = self.mysql.get_telegram_chat_by_id(chat_id=chat_id)
        file = await self._download_file_by_message_id(telegram_chat.telegram_chat_id, message_id)  # ← ИСПРАВЛЕНО
        if not file:
            return None

        file_name = await self._get_file_name_for_message(telegram_chat.telegram_chat_id, message_id)  # ← ИСПРАВЛЕНО
        _, file_path = self.file_util.save_file(file=file, path="cache", filename=file_name)
        self.mysql.add_telegram_cache(chat_id=chat_id, telegram_message_id=message_id, file_path=file_path)
        return file_path

    async def send_message(self, chat_id: int, text: str):
        if not self.client.is_connected():
            await self.client.connect()
        telegram_chat = self.mysql.get_telegram_chat_by_id(chat_id=chat_id)
        if not telegram_chat:
            raise ValueError("Chat not found")
        await self.client.send_message(telegram_chat.telegram_chat_id, text)  # ← ИСПРАВЛЕНО
        return {"success": True}


    async def get_message_as_block(self, chat_id: int, message_id: int) -> Optional[Block]:
        if not self.client.is_connected():
            await self.client.connect()
        
        # Получаем информацию о чате
        telegram_chat = self.mysql.get_telegram_chat_by_id(chat_id=chat_id)
        if not telegram_chat:
            print(f"[get_message_as_block] Чат с ID={chat_id} не найден")
            return None
        
        # Получаем сообщение из Telegram
        messages = await self.client.get_messages(
            entity=telegram_chat.telegram_chat_id,
            ids=message_id
        )
        
        if not messages:
            print(f"[get_message_as_block] Сообщение с ID={message_id} не найдено в чате {telegram_chat.telegram_chat_id}")
            return None
        
        message = messages[0] if isinstance(messages, list) else messages
        
        # Получаем информацию о медиа
        media_info = self._get_media_info(message)
        media_type = media_info["media_type"]
        
        # Обрабатываем текстовые сообщения
        if not message.media or media_type is None:
            if message.text and message.text.strip():
                return TextBlock(
                    content=message.text.strip()
                )
            return None
        
        # Обрабатываем ссылки
        if media_type == MediaType.LINK:
            link_content = message.text or ""
            return LinkBlock(
                content=link_content
            )
        
        # Обрабатываем файлы (фото, аудио, документы)
        if media_type in [MediaType.PHOTO, MediaType.AUDIO, MediaType.DOCUMENT]:
            # Скачиваем файл
            file = await self._download_file_by_message_id(telegram_chat.telegram_chat_id, message_id)
            if not file:
                print(f"[get_message_as_block] Не удалось скачать файл для сообщения {message_id}")
                return None
            
            # Сохраняем файл
            file_name = await self._get_file_name_for_message(telegram_chat.telegram_chat_id, message_id)
            _, file_path = self.file_util.save_file(file=file, path="files", filename=file_name)
            
            return FileBlock(
                media_type=media_type,
                file_name=file_name,
                file_path=file_path
            )
        
        print(f"[get_message_as_block] Неподдерживаемый тип медиа: {media_type} для сообщения {message_id}")
        return None

    # ===================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====================

    async def _to_message_schema(self, message: Message) -> MessageSchema:
        if self._me is None:
            self._me = await self.client.get_me()

        sender = await message.get_sender()
        sender_name = "Unknown"
        sender_id = None
        if sender:
            if isinstance(sender, User):
                sender_name = (sender.first_name or "") + (f" {sender.last_name}" if sender.last_name else "")
                sender_id = sender.id
            else:
                sender_name = getattr(sender, "title", "Unknown")
                sender_id = getattr(sender, "id", None)

        media_info = self._get_media_info(message)
        photo_base64 = None
        if media_info["media_type"] == MediaType.PHOTO:
            photo_base64 = await self._download_media_to_base64(message)

        is_outgoing = (sender_id is not None and self._me is not None and sender_id == self._me.id)

        return MessageSchema(
            id=message.id,
            tg_chat_id=message.chat_id or 0,
            text=message.text or "",
            sender_name=sender_name,
            sender_id=sender_id,
            media_type=media_info["media_type"],
            file_name=media_info["file_name"],
            photo_base64=photo_base64,
            file_path=None,
            is_outgoing=is_outgoing,
        )

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

                # Сначала определяем тип медиа
                is_gif = False
                for attr in document.attributes:
                    attr_name = type(attr).__name__
                    if 'Audio' in attr_name:
                        media_type = MediaType.AUDIO
                    elif 'Sticker' in attr_name:
                        media_type = MediaType.PHOTO
                    elif 'Animated' in attr_name or 'Gif' in attr_name:
                        media_type = MediaType.PHOTO
                        is_gif = True

                # Затем обрабатываем имя файла
                for attr in document.attributes:
                    if hasattr(attr, 'file_name') and attr.file_name:
                        file_name = attr.file_name
                        # Если это GIF, исправляем расширение
                        if is_gif and file_name.endswith('.mp4'):
                            file_name = file_name[:-4] + '.gif'
                        elif is_gif and not file_name.endswith('.gif'):
                            file_name += '.gif'
                        break
                else:
                    file_name = "unknown_file"

        return {"media_type": media_type, "file_name": file_name}
    
    

    async def _download_file_by_message_id(self, telegram_chat_id: int, message_id: int) -> Optional[io.BytesIO]:
        if not self.client.is_connected():
            await self.client.connect()
        msg = await self.client.get_messages(telegram_chat_id, ids=message_id)
        if not msg or not msg.media:
            return None
        data = await self.client.download_media(msg, file=bytes)
        data = await self._convert_to_gif_bytes(data)
        return io.BytesIO(data) if data else None

    async def _download_media_to_base64(self, message: Message) -> Optional[str]:
        if not message.media:
            return None
        try:
            data = await self.client.download_media(message.media, file=bytes)
            if not data:
                return None
            
            # Проверяем, является ли медиа GIF'ом
            is_gif = False
            if hasattr(message.media, 'document'):
                if hasattr(message.media.document, 'attributes'):
                    for attr in message.media.document.attributes:
                        attr_name = str(attr.__class__.__name__)
                        if 'Animated' in attr_name or 'Gif' in attr_name:
                            is_gif = True
                            break
            
            # Если это GIF, конвертируем в правильный формат
            if is_gif:
                data = await self._convert_to_gif_bytes(data)
            
            return base64.b64encode(data).decode("utf-8") if data else None
        except Exception as e:
            print(f"Error downloading media: {e}")
            return None

    async def _convert_to_gif_bytes(self, video_bytes: bytes) -> bytes:
        """
        Конвертирует видео-байты в GIF байты.
        """
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None, 
                self._mp4_to_gif_bytes_opencv, 
                video_bytes
            )
        except Exception as e:
            print(f"Error converting to GIF: {e}")
            return video_bytes  # Возвращаем оригинальные байты в случае ошибки

    def _mp4_to_gif_bytes_opencv(self, mp4_bytes: bytes, fps: int = 10, max_frames: int = 50, scale: float = 0.5) -> bytes:
        """
        Конвертация MP4 в GIF с использованием OpenCV.
        """
        try:
            # Создаем временный MP4 файл
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_mp4:
                temp_mp4.write(mp4_bytes)
                temp_mp4_path = temp_mp4.name
            
            try:
                # Читаем видео с помощью OpenCV
                cap = cv2.VideoCapture(temp_mp4_path)
                if not cap.isOpened():
                    return mp4_bytes
                
                frames = []
                frame_count = 0
                
                while frame_count < max_frames:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    # Конвертируем BGR (OpenCV) в RGB (Pillow)
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    pil_image = Image.fromarray(frame_rgb)
                    
                    # Уменьшаем размер для оптимизации
                    if scale != 1.0:
                        new_width = int(pil_image.width * scale)
                        new_height = int(pil_image.height * scale)
                        pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    
                    frames.append(pil_image)
                    frame_count += 1
                
                cap.release()
                
                # Сохраняем в GIF
                if frames:
                    gif_buffer = io.BytesIO()
                    frames[0].save(
                        gif_buffer,
                        format='GIF',
                        save_all=True,
                        append_images=frames[1:],
                        duration=1000 // fps,
                        loop=0,
                        optimize=True
                    )
                    return gif_buffer.getvalue()
                else:
                    return mp4_bytes
                    
            finally:
                # Удаляем временный файл
                try:
                    os.unlink(temp_mp4_path)
                except:
                    pass
                    
        except Exception as e:
            print(f"Error in OpenCV GIF conversion: {e}")
            return mp4_bytes
    
    async def _get_file_name_for_message(self, telegram_chat_id: int, message_id: int) -> str:
        if not self.client.is_connected():
            await self.client.connect()
        msg = await self.client.get_messages(telegram_chat_id, ids=message_id)
        if msg and msg.media:
            info = self._get_media_info(msg)
            return info["file_name"] or f"file_{message_id}"
        return f"file_{message_id}"

    async def _load_chats_from_telegram(self):
        if not self.client.is_connected():
            await self.client.connect()
        dialogs = await self.client.get_dialogs()
        for dialog in dialogs:
            if dialog.is_user or dialog.is_group or dialog.is_channel:
                file = await self._download_chat_icon(dialog)
                file_path = None
                if file:
                    _, file_path = self.file_util.save_file(file, path="icons", filename=f"chat_icon_{dialog.id}.jpg")
                self.mysql.add_telegram_chat(
                    tg_chat_id=dialog.id,
                    name=dialog.name,
                    file_path=file_path
                )

    async def _download_chat_icon(self, dialog) -> Optional[BinaryIO]:
        try:
            entity = dialog.entity
            if hasattr(entity, "photo") and entity.photo:
                data = await self.client.download_profile_photo(entity, file=bytes)
                if data:
                    return io.BytesIO(data)
        except Exception:
            pass
        return None