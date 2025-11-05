from typing import Optional

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from src.core.database import Base


class UserOrm(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tg_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    phone: Mapped[str] = mapped_column(String(50))
    password: Mapped[str] = mapped_column(String(50))
