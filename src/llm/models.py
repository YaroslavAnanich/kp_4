from datetime import datetime

from sqlalchemy import Integer, ForeignKey, DateTime, Text, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class ChatOrm(Base):
    __tablename__ = "llm_chat"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"))


class RequestResponseOrm(Base):
    __tablename__ = "request_response"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("llm_chat.id", ondelete="CASCADE"))
    request_content: Mapped[str] = mapped_column(Text)
    response_content: Mapped[str] = mapped_column(Text)


class QdrantCollectionOrm(Base):
    __tablename__ = "qdrant_collection"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    collection_name: Mapped[str] = mapped_column(String)
    tag: Mapped[str] = mapped_column(String, nullable=True)


class ChatCollectionOrm(Base):
    __tablename__ = "chat_collection"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("llm_chat.id", ondelete="CASCADE"))
    qdrant_collection_id: Mapped[int] = mapped_column(Integer, ForeignKey("qdrant_collection.id", ondelete="CASCADE"))

