from enum import Enum
from pydantic import BaseModel, Field
from uuid import UUID

from src.core.schemes import MediaType


# --- Enums ---

class BlockType(str, Enum):
    """Определяет тип блока контента."""
    TEXT = "text"
    HEADER = "header"
    TABLE = "table"
    LIST = "list"
    FILE = "file"
    LINK = "link"

class ListType(str, Enum):
    """Определяет тип блока контента."""
    BULLET = "bullet"
    NUMBER = "number"

# --- Styles ---

class TextStyle(BaseModel):
    """Стилизация для TextSpan."""
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strikethrough: bool = False
    color: str = "black"
    backgroundColor: str | None = None





# --- Text Content ---

class TextSpan(BaseModel):
    """Единица текста с примененным форматированием."""
    text: str
    style: TextStyle = Field(default_factory=TextStyle)


# --- Base Block and Unions ---

class Block(BaseModel):
    """Базовый класс для всех блоков."""
    id: str = None
    type: BlockType
    order: int | None = None # если None, то вложен в какой-то другой блок



# --- Concrete Blocks ---

class TextBlock(Block):
    """Блок обычного текста (параграф)."""
    type: BlockType = BlockType.TEXT
    content: list[TextSpan]


class HeaderBlock(Block):
    """Блок заголовка."""
    type: BlockType = BlockType.HEADER
    content: list[TextSpan]
    level: int = 1  # уровень заголовка (1-6)


class TableBlock(Block):
    """Блок таблицы."""
    type: BlockType = BlockType.TABLE
    content: list[list[UUID | dict]]
    row_count: int = 3
    column_count: int = 3



class FileBlock(Block):
    """Блок файла (изображение, PDF и т.д.)."""
    type: BlockType = BlockType.FILE
    media_type: MediaType
    file_name:  str | None = None
    file_path: str | None = None #При добавлении блока всегда None


class ListBlock(Block):
    """Блок маркированного списка."""
    type: BlockType = BlockType.LIST
    list_type: ListType
    content: list[UUID | dict]


class LinkBlock(Block):
    type: BlockType = BlockType.LINK
    media_type: MediaType = MediaType.LINK
    content: str = ""


AnyBlock = TextBlock | HeaderBlock | TableBlock | FileBlock | ListBlock | LinkBlock