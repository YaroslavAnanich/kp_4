from sqlalchemy import select, update

from src.llm.models import ChatCollectionOrm, ChatOrm
from src.notion.models import QdrantCollectionOrm


class NotionMysql:
    def __init__(self, engine, session_factory):
        self.engine = engine
        self.session_factory = session_factory

    def add_qdrant_collection(self, collection_name: str, tag: str | None = None) -> QdrantCollectionOrm:
        with self.session_factory() as session:
            collection = QdrantCollectionOrm(
                collection_name=collection_name,
                tag=tag
            )
            session.add(collection)
            session.commit()
            session.refresh(collection)
            return collection

    def delete_qdrant_collection_by_id(self, collection_id: str) -> bool:
        with self.session_factory() as session:
            collection = session.execute(
                select(QdrantCollectionOrm)
                .where(QdrantCollectionOrm.id == collection_id)
            ).scalar_one_or_none()

            if collection:
                session.delete(collection)
                session.commit()
                return True
            return False

    def update_qdrant_collection_tag_by_id(self, collection_id: str, new_tag: str) -> None:
        with self.session_factory() as session:
            query = (
                update(QdrantCollectionOrm)
                .where(QdrantCollectionOrm.id == collection_id)
                .values(tag=new_tag)
            )
            session.execute(query)
            session.commit()

    def get_qdrant_collection_by_user_id_with_null_tag(self, user_id: int) -> list[QdrantCollectionOrm]:
        with self.session_factory() as session:
            query = (
                select(QdrantCollectionOrm)
                .select_from(QdrantCollectionOrm)
                .join(ChatCollectionOrm, QdrantCollectionOrm.id == ChatCollectionOrm.qdrant_collection_id)
                .join(ChatOrm, ChatCollectionOrm.chat_id == ChatOrm.id)
                .where(
                    ChatOrm.user_id == user_id,
                    QdrantCollectionOrm.tag.is_(None)
                )
            )
            result = session.execute(query)
            return result.scalars().all()

    def get_all_tags_with_collections(self) -> dict[str, list[QdrantCollectionOrm]]:
        with self.session_factory() as session:
            # Получаем все коллекции, у которых есть тег (tag не NULL)
            query = (
                select(QdrantCollectionOrm)
                .where(QdrantCollectionOrm.tag.is_not(None))
                .order_by(QdrantCollectionOrm.tag)
            )
            result = session.execute(query)
            collections = result.scalars().all()

            # Группируем коллекции по тегам
            tags_with_collections = {}
            for collection in collections:
                tag = collection.tag
                if tag not in tags_with_collections:
                    tags_with_collections[tag] = []
                tags_with_collections[tag].append(collection)

            return tags_with_collections