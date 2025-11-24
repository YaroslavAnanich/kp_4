from typing import Optional
from sqlalchemy import select, update
from src.notion.models import CollectionOrm, TagOrm


class NotionMysql:
    def __init__(self, engine, session_factory):
        self.engine = engine
        self.session_factory = session_factory

    def add_collection(self, qdrant_collection_name: str, name: str) -> CollectionOrm:
        with self.session_factory() as session:
            collection = CollectionOrm(
                qdrant_collection_name = qdrant_collection_name,
                name=name
            )
            session.add(collection)
            session.commit()
            session.refresh(collection)
            return collection

    def delete_collection_by_id(self, collection_id: int) -> bool:
        with self.session_factory() as session:
            collection = session.execute(
                select(CollectionOrm)
                .where(CollectionOrm.id == collection_id)
            ).scalar_one_or_none()

            if collection:
                session.delete(collection)
                session.commit()
                return True
            return False

    def update_collection_tag_by_id(self, collection_id: int, tag_id: int) -> Optional[CollectionOrm]:
        with self.session_factory() as session:
            # Обновляем коллекцию
            update_query = (
                update(CollectionOrm)
                .where(CollectionOrm.id == collection_id)
                .values(tag_id=tag_id)
            )
            session.execute(update_query)
            session.commit()
            
            # Получаем обновленную коллекцию
            select_query = (
                select(CollectionOrm)
                .where(CollectionOrm.id == collection_id)
            )
            result = session.execute(select_query)
            return result.scalar_one_or_none()

    def update_collection_name_by_id(self, collection_id: int, name: str) -> Optional[CollectionOrm]:
        with self.session_factory() as session:
            # Обновляем коллекцию
            update_query = (
                update(CollectionOrm)
                .where(CollectionOrm.id == collection_id)
                .values(name=name)
            )
            session.execute(update_query)
            session.commit()
            
            # Получаем обновленную коллекцию
            select_query = (
                select(CollectionOrm)
                .where(CollectionOrm.id == collection_id)
            )
            result = session.execute(select_query)
            return result.scalar_one_or_none()

    def update_collection_order_list_by_id(self, collection_id: int, order_list: list[str]) -> Optional[CollectionOrm]:
        with self.session_factory() as session:
            # Обновляем коллекцию
            update_query = (
                update(CollectionOrm)
                .where(CollectionOrm.id == collection_id)
                .values(order_list=order_list)
            )
            session.execute(update_query)
            session.commit()
            
            # Получаем обновленную коллекцию
            select_query = (
                select(CollectionOrm)
                .where(CollectionOrm.id == collection_id)
            )
            result = session.execute(select_query)
            return result.scalar_one_or_none()

    def get_collection_by_id(self, collection_id: int) -> CollectionOrm:
        with self.session_factory() as session:
            query = (
                select(CollectionOrm)
                .where(CollectionOrm.id == collection_id)
            )
            result = session.execute(query)
            return result.scalar_one_or_none()    

    def get_all_collections(self) -> list[CollectionOrm]:
        with self.session_factory() as session:
            query = (
                select(CollectionOrm)
            )
            result = session.execute(query)
            return result.scalars().all()

    def add_tag(self, name: str) -> TagOrm:
        with self.session_factory() as session:
            existing_tag = session.execute(
                select(TagOrm).where(TagOrm.name == name)
            ).scalar_one_or_none()

            if existing_tag:
                return existing_tag

            tag = TagOrm(name=name)
            session.add(tag)
            session.commit()
            session.refresh(tag)
            return tag

    def get_unique_tags(self) -> list[TagOrm]:
        with self.session_factory() as session:
            query = (
                select(TagOrm)
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
