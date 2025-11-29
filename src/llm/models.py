from sqlalchemy import JSON, Integer, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class LlmChatOrm(Base):
    __tablename__ = "llm_chat"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), default="New chat")

class RequestResponseOrm(Base):
    __tablename__ = "request_response"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("llm_chat.id", ondelete="CASCADE"))
    request_content: Mapped[str] = mapped_column(Text)
    response_content: Mapped[str] = mapped_column(Text)
    documents: Mapped[list] = mapped_column(JSON, nullable=True, default=list)


class ChatContextOrm(Base):
    __tablename__ = "chat_collection"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("llm_chat.id", ondelete="CASCADE"))
    qdrant_collection_id: Mapped[int] = mapped_column(Integer, ForeignKey("qdrant_collection.id", ondelete="CASCADE"))

