import uuid
import asyncio
from typing import List, Union, Dict, Any

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


class NotionQdrant:
    """Класс для работы с векторной базой данных Qdrant"""

    def __init__(self, host: str = QDRANT_HOST, port: int = QDRANT_PORT):
        self.client = AsyncQdrantClient(host=host, port=port)
        self.model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        print(f"Используется модель для векторизации: {EMBEDDING_MODEL_NAME}")

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
        text_to_embed = self.extract_text_content(block)
        vector = await asyncio.to_thread(self.model.encode, text_to_embed)
        vector = vector.tolist()

        if block.id is not str(uuid.uuid4()):
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
        """Обновляет блок в коллекции."""
        return await self.add_block(collection_name, block)

    async def get_collection_blocks(self, collection_name: str) -> List[Dict[str, Any]]:
        """Получает все блоки из коллекции в виде сырых данных."""
        scroll_result = await self.client.scroll(
            collection_name=collection_name,
            limit=10000,
            with_payload=True,
            with_vectors=False
        )

        # Преобразуем точки в словари для единообразия
        points_data = []
        for point in scroll_result[0] or []:
            point_dict = {
                'id': point.id,
                'payload': point.payload
            }
            points_data.append(point_dict)

        return points_data

    async def search_blocks(
            self,
            query_text: str,
            collection_names: List[str],
            limit: int = 10,
            score_threshold: float = 0.3
    ) -> List[dict]:
        """Ищет блоки по текстовому запросу в указанных коллекциях."""
        query_vector = await asyncio.to_thread(self.model.encode, query_text)
        query_vector = query_vector.tolist()

        all_results = []

        for collection_name in collection_names:
            try:
                search_result = await self.client.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=limit,
                    with_payload=True,
                    with_vectors=False
                )

                for point in search_result:
                    if point.payload and point.score > score_threshold:
                        all_results.append({
                            'payload': point.payload,
                            'score': point.score,
                            'collection': collection_name
                        })
            except Exception as e:
                print(f"Ошибка поиска в коллекции {collection_name}: {e}")
                continue

        return all_results[:limit]

    @staticmethod
    def extract_text_content(block: AnyBlock) -> str:
        """Извлекает текст из блока для векторизации."""
        if isinstance(block, (TextBlock, HeaderBlock)):
            return " ".join([span.text for span in block.content])

        if isinstance(block, FileBlock):
            if block.media_type == MediaType.DOCUMENT:
                file_text = FileUtil().get_file_text(block.server_name)
                return file_text
            else:
                return ""
        else:
            return ""

    @staticmethod
    def _pydantic_to_payload(block: AnyBlock) -> dict:
        """Конвертирует Pydantic модель в словарь для Qdrant Payload."""
        return block.model_dump(mode='json')

    @staticmethod
    def payload_to_pydantic(payload: dict) -> AnyBlock:
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
            return LinkBlock(**payload)
        else:
            raise ValueError(f"Unknown block type: {block_type}")