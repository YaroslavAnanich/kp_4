import uuid
import asyncio
from typing import List, Union, Optional, Dict
from uuid import UUID

from qdrant_client import AsyncQdrantClient, models
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

from src.notion.schemes import AnyBlock, BlockType, TextBlock, HeaderBlock, TableBlock, FileBlock, ListBlock, LinkBlock
from src.core.utils.file_util import FileUtil
from src.core.schemes import MediaType

# Настройки векторизации и Qdrant
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_VECTOR_SIZE = 384
QDRANT_HOST = "localhost"
QDRANT_PORT = 6333


class NotionService:
    def __init__(self, host: str = QDRANT_HOST, port: int = QDRANT_PORT):
        self.client = AsyncQdrantClient(host=host, port=port)
        self.model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        self.file_util = FileUtil()
        print(f"Используется модель для векторизации: {EMBEDDING_MODEL_NAME}")

    ## 🛠️ Вспомогательные методы

    def _extract_text_content(self, block: AnyBlock) -> str:
        """Извлекает текст из блока для векторизации, используя обновленные модели."""
        if isinstance(block, (TextBlock, HeaderBlock)):
            return " ".join([span.text for span in block.content])

        if isinstance(block, FileBlock):
            print("deeee")
            if block.media_type == MediaType.DOCUMENT:
                file_text = self.file_util.get_file_text(block.server_name)
                print(file_text)
                return file_text
            else:
                return""
        else:
            return ""

    def _pydantic_to_payload(self, block: AnyBlock) -> dict:
        """Конвертирует Pydantic модель в словарь для Qdrant Payload."""
        return block.model_dump(mode='json')

    def _payload_to_pydantic(self, payload: dict) -> AnyBlock:
        """Конвертирует Qdrant Payload (словарь) обратно в Pydantic модель."""
        block_type = payload.get("type")

        if block_type == BlockType.TEXT.value:
            return TextBlock(**payload)
        elif block_type == BlockType.HEADER.value:
            return HeaderBlock(**payload)
        elif block_type == BlockType.TABLE.value:
            return TableBlock(**payload)
        elif block_type == BlockType.FILE.value:
            return FileBlock(**payload)
        elif block_type == BlockType.LIST.value:
            return ListBlock(**payload)
        elif block_type == BlockType.LINK.value:
            return LinkBlock(**payload)  # Добавлена обработка LinkBlock
        else:
            raise ValueError(f"Unknown block type: {block_type}")

    ## 🔄 Рекурсивное разрешение вложенных блоков

    def _resolve_nested_blocks(self, block: AnyBlock, block_cache: Dict[UUID, AnyBlock]) -> AnyBlock:
        """Рекурсивно заменяет UUID в поле 'content' на реальные объекты блоков."""
        updated_data = block.model_dump()

        # Разрешение списков
        if isinstance(block, ListBlock):
            resolved_items = []
            for item_id in block.content:
                if item_id in block_cache:
                    resolved_block = self._resolve_nested_blocks(block_cache[item_id], block_cache)
                    resolved_items.append(resolved_block)
            updated_data['content'] = resolved_items


            return ListBlock(**updated_data)


        # Разрешение таблиц
        elif isinstance(block, TableBlock):
            resolved_body = []
            for row in block.content:
                resolved_row = []
                for cell_id in row:
                    if cell_id in block_cache:
                        resolved_block = self._resolve_nested_blocks(block_cache[cell_id], block_cache)
                        resolved_row.append(resolved_block)
                resolved_body.append(resolved_row)
            updated_data['content'] = resolved_body

            return TableBlock(**updated_data)

        # Для остальных блоков нет вложенности, возвращаем их как есть
        return block

    ## 💾 CRUD Методы

    async def create_collection(self) -> str:
        """Создает новую коллекцию (заметку)."""
        collection_name = str(uuid.uuid4())
        await self.client.recreate_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=EMBEDDING_VECTOR_SIZE, distance=Distance.COSINE),
        )
        print(f"Создана коллекция: {collection_name}")
        return collection_name

    async def delete_collection(self, collection_name: str) -> bool:
        """Удаляет коллекцию (заметку)."""
        await self.client.delete_collection(collection_name=collection_name)
        return True

    async def add_block(self, collection_name: str, block: AnyBlock) -> AnyBlock:
        """Добавляет новый блок в заметку."""
        text_to_embed = self._extract_text_content(block)
        vector = await asyncio.to_thread(self.model.encode, text_to_embed)
        vector = vector.tolist()
        block.id = str(uuid.uuid4())
        payload = self._pydantic_to_payload(block)

        await self.client.upsert(
            collection_name=collection_name,
            points=[
                PointStruct(
                    id=block.id,
                    vector=vector,
                    payload=payload,
                )
            ],
            wait=True,
        )
        return block


    async def delete_block(self, collection_name: str, block_id: Union[str, int]) -> bool:
        """Удаляет блок по его ID."""
        await self.client.delete_points(
            collection_name=collection_name,
            points_selector=models.PointIdsList(points=[block_id]),
            wait=True
        )
        return True

    async def update_block(self, collection_name: str, block: AnyBlock) -> AnyBlock:
        return await self.add_block(collection_name, block)



    async def get_collection(self, collection_name: str):
        """
        Получает все блоки из коллекции, собирает их, разрешая вложенные ссылки,
        и возвращает упорядоченную страницу.
        """

        # 1. Получаем все точки (Payload) из коллекции для кэширования
        scroll_result = await self.client.scroll(
            collection_name=collection_name,
            limit=10000,
            with_payload=True,
            with_vectors=False
        )

        if not scroll_result[0]:
            return []

        # 2. Создаем кэш всех блоков: {UUID: AnyBlock}
        block_cache: Dict[UUID, AnyBlock] = {}

        for point in scroll_result[0]:
            if point.payload and point.id is not None:
                try:
                    if isinstance(point.id, int):
                        point.payload['id'] = str(point.id)

                    block = self._payload_to_pydantic(point.payload)

                    if block.id is not None:
                        block_cache[block.id] = block

                except Exception as e:
                    print(f"Ошибка десериализации блока {point.id}: {e}")
                    continue

        # 3. Разрешаем вложенные блоки и отбираем только корневые блоки
        resolved_root_blocks: List[AnyBlock] = []

        for block_id, block in block_cache.items():
            if block.order is not None:
                resolved_block = self._resolve_nested_blocks(block, block_cache)
                resolved_root_blocks.append(resolved_block)

        # 4. Сортируем корневые блоки по полю 'order'
        resolved_root_blocks.sort(key=lambda block: block.order)

        # 5. Возвращаем готовую схему
        return resolved_root_blocks