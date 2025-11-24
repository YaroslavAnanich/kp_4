from typing import Dict, Union, List
from uuid import UUID

from src.core.database import engine, session_factory
from src.core.utils.file_util import FileUtil
from src.notion.models import CollectionOrm, TagOrm
from src.notion.mysql import NotionMysql
from src.notion.qdrant import NotionQdrant
from src.notion.schemes import AnyBlock


class NotionService:
    """Сервис для бизнес-логики работы с Notion блоками"""

    def __init__(self):
        self.qdrant = NotionQdrant()
        self.mysql = NotionMysql(engine=engine, session_factory=session_factory)
        self.file_util = FileUtil()


    async def create_collection(self, name: str) -> CollectionOrm:
        qdrant_collection_name = await self.qdrant.create_collection()
        return self.mysql.add_collection(qdrant_collection_name=qdrant_collection_name, name=name)

    async def delete_collection(self, collection_id: int) -> bool:
        collection = self.mysql.get_collection_by_id(collection_id=collection_id)
        await self.qdrant.delete_collection(collection.qdrant_collection_name)
        self.mysql.delete_collection_by_id(collection_id)

    async def update_collection_tag(self, collection_id: int, tag_id: int) -> None:
        return self.mysql.update_collection_tag_by_id(collection_id=collection_id, tag_id=tag_id)
        
    async def update_collection_name(self, collection_id: int, name: str) -> None:
        return self.mysql.update_collection_name_by_id(collection_id=collection_id, name=name)
        
    async def update_collection_order_list(self, collection_id: int, order_list: list[int]) -> None:
        return self.mysql.update_collection_order_list_by_id(collection_id=collection_id, order_list=order_list)

    async def get_all_collections(self) -> list[CollectionOrm]:
        return self.mysql.get_all_collections()

    async def create_tag(self,name: str) -> TagOrm:
        return self.mysql.add_tag(name=name)

    async def get_all_tags(self) -> TagOrm:
        return self.mysql.get_unique_tags()

    async def delete_tag(self, tag_id: int) -> bool:
        return self.mysql.delete_tag_by_id(tag_id=tag_id)

    async def add_block(self, collection_id: int, block: AnyBlock) -> AnyBlock:
        collection = self.mysql.get_collection_by_id(collection_id=collection_id)
        return await self.qdrant.add_block(collection.qdrant_collection_name, block)

    async def delete_block(self, collection_id: int, block_id: Union[str, int]) -> bool:
        collection = self.mysql.get_collection_by_id(collection_id=collection_id)
        return await self.qdrant.delete_block(collection.qdrant_collection_name, block_id)

    async def get_collection_content(self, collection_id: int) -> List[AnyBlock]:
        collection = self.mysql.get_collection_by_id(collection_id=collection_id)
        point_list = await self.qdrant.get_collection_blocks(collection.qdrant_collection_name)
        block_list = []
        for point in point_list:
            block = self.qdrant.payload_to_pydantic(point.get("payload"))
            block.id = point.get("id")
            block_list.append(block)
        
        # Создаем словарь для быстрого поиска блоков по ID
        block_dict = {block.id: block for block in block_list}
        
        # Сортируем блоки в соответствии с order_list
        sorted_blocks = []
        for block_id in collection.order_list:
            if block_id in block_dict:
                sorted_blocks.append(block_dict[block_id])
        
        return {"content": sorted_blocks, "order_list": collection.order_list}


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
