from sqlalchemy import select, update
from src.notion.models import QdrantCollectionOrm, TagOrm


class NotionMysql:
    def __init__(self, engine, session_factory):
        self.engine = engine
        self.session_factory = session_factory

    def add_qdrant_collection(self, user_id: int, qdrant_id: str, name: str) -> QdrantCollectionOrm:
        with self.session_factory() as session:
            collection = QdrantCollectionOrm(
                user_id = user_id,
                qdrant_id=qdrant_id,
                name=name
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

    def update_qdrant_collection_by_id(self, collection_id: str, tag_id: int, name: str) -> None:

        with self.session_factory() as session:
            query = (
                update(QdrantCollectionOrm)
                .where(QdrantCollectionOrm.id == collection_id)
                .values(tag_id=tag_id, name=name)
            )
            session.execute(query)
            session.commit()



    def get_all_qdrant_collections_by_user_id(self, user_id: int) -> list[QdrantCollectionOrm]:
        with self.session_factory() as session:
            query = (
                select(QdrantCollectionOrm)
                .where(QdrantCollectionOrm.user_id == user_id)
            )
            result = session.execute(query)
            return result.scalars().all()

    def add_tag(self, user_id: int, name: str) -> TagOrm:
        with self.session_factory() as session:
            existing_tag = session.execute(
                select(TagOrm).where(TagOrm.name == name)
            ).scalar_one_or_none()

            if existing_tag:
                return existing_tag

            tag = TagOrm(user_id=user_id, name=name)
            session.add(tag)
            session.commit()
            session.refresh(tag)
            return tag

    def get_unique_tags_by_user_id(self, user_id: int) -> list[TagOrm]:
        with self.session_factory() as session:
            query = (
                select(TagOrm)
                .where(TagOrm.user_id == user_id)
            )
            result = session.execute(query)
            return result.scalars().all()

    def delete_tag_by_id(self, tag_id: int) -> bool:
        with self.session_factory() as session:
            tag = session.execute(
                select(TagOrm).where(TagOrm.id == tag_id)
            ).scalar_one_or_none()

            if tag:
                session.delete(tag)
                session.commit()
                return True
            return False
