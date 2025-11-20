from enum import Enum
from pydantic import BaseModel
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


# --- Base Block and Unions ---

class Block(BaseModel):
    """Базовый класс для всех блоков."""
    id: str = None
    type: BlockType

# --- Concrete Blocks ---

class TextBlock(Block):
    """Блок обычного текста (параграф)."""
    type: BlockType = BlockType.TEXT
    content: str


class HeaderBlock(Block):
    """Блок заголовка."""
    type: BlockType = BlockType.HEADER
    content: str
    level: int = 1  # уровень заголовка (1-6)


class TableBlock(Block):
    """Блок таблицы."""
    type: BlockType = BlockType.TABLE
    content: list[list[str]]
    row_count: int = 3
    column_count: int = 3



class FileBlock(Block):
    """Блок файла (изображение, PDF и т.д.)."""
    type: BlockType = BlockType.FILE
    media_type: MediaType
    file_name:  str | None = None
    file_path: str


class ListBlock(Block):
    """Блок маркированного списка."""
    type: BlockType = BlockType.LIST
    list_type: ListType
    content: str = ""


class LinkBlock(Block):
    type: BlockType = BlockType.LINK
    media_type: MediaType = MediaType.LINK
    content: str = ""


AnyBlock = TextBlock | HeaderBlock | TableBlock | FileBlock | ListBlock | LinkBlock