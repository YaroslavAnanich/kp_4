from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class QdrantCollectionOrm(Base):
    __tablename__ = "qdrant_collection"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    tag_id: Mapped[int] = mapped_column(Integer, ForeignKey("tag_id.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=True)


class TagOrm(Base):
    __tablename__ = "tag_id"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    qdrant_collection_id: Mapped[int] = mapped_column(Integer, ForeignKey("qdrant_collection.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=True)