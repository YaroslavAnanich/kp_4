from typing import Dict, Union, List
from uuid import UUID

from src.core.database import engine, session_factory
from src.core.utils.file_util import FileUtil
from src.notion.models import QdrantCollectionOrm, TagOrm
from src.notion.mysql import NotionMysql
from src.notion.qdrant import NotionQdrant
from src.notion.schemes import AnyBlock, ListBlock, TableBlock


class NotionService:
    """Сервис для бизнес-логики работы с Notion блоками"""

    def __init__(self):
        self.qdrant = NotionQdrant()
        self.mysql = NotionMysql(engine=engine, session_factory=session_factory)
        self.file_util = FileUtil()


    async def create_collection(self, user_id: int, name: str) -> QdrantCollectionOrm:
        qdrant_id = await self.qdrant.create_collection()
        return self.mysql.add_qdrant_collection(user_id=user_id, qdrant_id=qdrant_id, name=name)

    async def delete_collection(self, qdrant_id: str, collection_id: str) -> bool:
        await self.qdrant.delete_collection(qdrant_id)
        self.mysql.delete_qdrant_collection_by_id(collection_id)

    async def update_qdrant_collection(self, collection_id: str, tag_id: str, name: str) -> None:
        self.mysql.update_qdrant_collection_by_id(collection_id=collection_id, tag_id=tag_id, name=name)

    async def get_all_qdrant_collections(self, user_id: int) -> list[QdrantCollectionOrm]:
        return self.mysql.get_all_qdrant_collections_by_user_id(user_id=user_id)

    async def create_tag(self, user_id: int, name: str) -> TagOrm:
        return self.mysql.add_tag(user_id=user_id ,name=name)

    async def get_all_tags(self, user_id: int) -> TagOrm:
        return self.mysql.get_unique_tags_by_user_id(user_id=user_id)

    async def delete_tag(self, tag_id: int) -> bool:
        return self.mysql.delete_tag_by_id(tag_id=tag_id)

    async def add_block(self, collection_name: str, block: AnyBlock) -> AnyBlock:
        return await self.qdrant.add_block(collection_name, block)

    async def delete_block(self, collection_name: str, block_id: Union[str, int]) -> bool:
        return await self.qdrant.delete_block(collection_name, block_id)

    async def update_block(self, collection_name: str, block: AnyBlock) -> AnyBlock:
        return await self.qdrant.update_block(collection_name, block)

    async def get_collection(self, collection_name: str) -> List[AnyBlock]:
        # 1. Получаем все точки из коллекции
        points = await self.qdrant.get_collection_blocks(collection_name)

        if not points:
            return []

        # 2. Создаем кэш всех блоков: {UUID: AnyBlock}
        block_cache: Dict[UUID, AnyBlock] = {}

        for point in points:
            # Теперь point гарантированно словарь
            payload = point.get('payload')
            point_id = point.get('id')

            if payload and point_id is not None:
                try:
                    # Создаем копию payload для модификации
                    processed_payload = payload.copy()
                    if isinstance(point_id, int):
                        processed_payload['id'] = str(point_id)

                    block = self.qdrant.payload_to_pydantic(processed_payload)

                    if block.id is not None:
                        block_cache[block.id] = block

                except Exception as e:
                    print(f"Ошибка десериализации блока {point_id}: {e}")
                    continue

        # 3. Разрешаем вложенные блоки и отбираем только корневые блоки
        resolved_root_blocks: List[AnyBlock] = []

        for block_id, block in block_cache.items():
            if hasattr(block, 'order') and block.order is not None:
                resolved_block = self._resolve_nested_blocks(block, block_cache)
                resolved_root_blocks.append(resolved_block)

        # 4. Сортируем корневые блоки по полю 'order'
        resolved_root_blocks.sort(key=lambda block: block.order)

        # 5. Возвращаем готовую схему
        return resolved_root_blocks

    async def search_in_notion(self, query_text: str, collection_names: List[str], limit: int = 10) -> str:
        """
        Возвращает только чистый текстовый контекст без метаданных.
        """
        search_results = await self.qdrant.search_blocks(
            query_text=query_text,
            collection_names=collection_names,
            limit=limit
        )

        text_chunks = []

        for result in search_results:
            try:
                block = self.qdrant.payload_to_pydantic(result['payload'])
                text_content = self.qdrant.extract_text_content(block).strip()
                if text_content:
                    text_chunks.append(text_content)
            except Exception:
                continue

        # Ограничиваем общее количество чанков
        return "\n\n".join(text_chunks[:limit]) if text_chunks else "Не найдено релевантной информации."


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