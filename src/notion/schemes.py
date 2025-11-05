import uuid
from enum import Enum
from typing import List, Optional, Union
from pydantic import BaseModel, Field
from uuid import UUID



# --- Enums ---

class BlockType(str, Enum):
    """Определяет тип блока контента."""
    TEXT = "text"
    HEADER = "header"
    TABLE = "table"
    BULLET_LIST = "bullet_list"
    NUMBERED_LIST = "numbered_list"
    FILE = "file"
    LINK = "link"


# --- Styles ---

class TextStyle(BaseModel):
    """Стилизация для TextSpan."""
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strikethrough: bool = False
    color: str = "black"
    backgroundColor: Optional[str] = None


class BlockStyle(BaseModel):
    """Общие стили для блочных элементов."""
    align: str = "left"


class TableStyle(BlockStyle):
    """Стили для таблиц."""
    border: bool = True
    borderColor: str = "black"
    columnCount: int = 3


class ListStyle(BlockStyle):
    """Стили для списков."""
    bulletType: str = "circle"  # circle, square


class FileStyle(BlockStyle):
    """Стили для файлов."""
    width: Optional[str] = None
    height: Optional[str] = None
    display: str = "inline"  # inline, block


# --- Text Content ---

class TextSpan(BaseModel):
    """Единица текста с примененным форматированием."""
    text: str
    style: TextStyle = Field(default_factory=TextStyle)


# --- Base Block and Unions ---

class Block(BaseModel):
    """Базовый класс для всех блоков."""
    id: str = str(uuid.uuid4())
    type: BlockType
    order: Optional[int] = None # если None, то вложен в какой-то другой блок
    style: BlockStyle = Field(default_factory=BlockStyle)



# --- Concrete Blocks ---

class TextBlock(Block):
    """Блок обычного текста (параграф)."""
    type: BlockType = BlockType.TEXT
    content: List[TextSpan]
    style: BlockStyle = Field(default_factory=BlockStyle)


class HeaderBlock(Block):
    """Блок заголовка."""
    type: BlockType = BlockType.HEADER
    content: List[TextSpan]
    level: int = 1  # уровень заголовка (1-6)
    style: BlockStyle = Field(default_factory=BlockStyle)


class TableBlock(Block):
    """Блок таблицы."""
    type: BlockType = BlockType.TABLE
    content: Optional[List[List[Union[UUID, dict]]]]
    style: TableStyle = Field(default_factory=TableStyle)


class FileBlock(Block):
    """Блок файла (изображение, PDF и т.д.)."""
    type: BlockType = BlockType.FILE
    file_name: str
    server_name: str
    style: FileStyle = Field(default_factory=FileStyle)


class BulletListBlock(Block):
    """Блок маркированного списка."""
    type: BlockType = BlockType.BULLET_LIST
    content: Optional[List[Union[UUID, 'AnyBlock']]] = None
    style: ListStyle = Field(default_factory=ListStyle)


class NumberedListBlock(Block):
    """Блок нумерованного списка."""
    type: BlockType = BlockType.NUMBERED_LIST
    content: Optional[List[Union[UUID, 'AnyBlock']]] = None
    style: ListStyle = Field(default_factory=ListStyle)

class LinkBlock(Block):
    type: BlockType = BlockType.LINK
    content: str
    style: BlockStyle = Field(default_factory=BlockStyle)

# Обновляем Union для всех типов блоков
AnyBlock = Union[TextBlock, HeaderBlock, TableBlock, FileBlock, BulletListBlock, NumberedListBlock, LinkBlock]