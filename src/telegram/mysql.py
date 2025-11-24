from sqlalchemy import select
from src.telegram.models import TelegramChatOrm, TelegramCacheOrm


class TelegramMysql:
    def __init__(self, engine, session_factory):
        self.engine = engine
        self.session_factory = session_factory

    def add_telegram_chat(self, tg_chat_id: int, name: str, file_path: str) -> TelegramChatOrm:
        with self.session_factory() as session:
            telegram_chat = TelegramChatOrm(
                telegram_chat_id=tg_chat_id,
                name=name,
                file_path=file_path
            )
            session.add(telegram_chat)
            session.commit()
            session.refresh(telegram_chat)
            return telegram_chat

    def get_all_chats(self) -> list[TelegramChatOrm]:
        with self.session_factory() as session:
            query = (
                select(TelegramChatOrm)
            )
            result = session.execute(query)
            return result.scalars().all()
        
    def get_telegram_chat_by_id(self, chat_id: int) -> TelegramChatOrm:
        with self.session_factory() as session:
            query = (
                select(TelegramChatOrm)
                .where(TelegramChatOrm.id == chat_id)
            )
            result = session.execute(query)
            return result.scalar_one_or_none()  

    def add_telegram_cache(self, chat_id: int, telegram_message_id: int, file_path: str = None) -> TelegramCacheOrm:
        with self.session_factory() as session:
            telegram_cache = TelegramCacheOrm(
                chat_id=chat_id,
                telegram_message_id=telegram_message_id,
                file_path=file_path
            )
            session.add(telegram_cache)
            session.commit()
            session.refresh(telegram_cache)
            return telegram_cache

    def get_cache_by_telegram_chat_id(self, telegram_chat_id: int) -> list[TelegramCacheOrm]:
        with self.session_factory() as session:
            query = (
                select(TelegramCacheOrm)
                .select_from(TelegramCacheOrm)
                .join(TelegramChatOrm, TelegramCacheOrm.chat_id == TelegramChatOrm.id)
                .where(TelegramChatOrm.telegram_chat_id == telegram_chat_id)
            )
            result = session.execute(query)
            return result.scalars().all()
    