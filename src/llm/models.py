from datetime import datetime

from sqlalchemy import Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class ChatOrm(Base):
    __tablename__ = "llm_chat"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime)


class RequestResponseOrm(Base):
    __tablename__ = "llm_chat_block"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("llm_chat.id", ondelete="CASCADE"))
    request_content: Mapped[str] = mapped_column(Text)
    response_content: Mapped[str] = mapped_column(Text)
