from sqlalchemy import select

from src.llm.models import ChatOrm, RequestResponseOrm, ChatCollectionOrm
from src.notion.models import QdrantCollectionOrm


class LlmMysql:
    def __init__(self, engine, session_factory):
        self.engine = engine
        self.session_factory = session_factory


    #LLM Chats
    def add_chat(self, user_id: int) -> ChatOrm:
        with self.session_factory() as session:
            chat = ChatOrm(user_id=user_id)
            session.add(chat)
            session.commit()
            session.refresh(chat)  # Обновляем объект, чтобы получить сгенерированный ID
            return chat

    def delete_chat(self, chat_id: int) -> bool:
        with self.session_factory() as session:
            chat = session.get(ChatOrm, chat_id)
            if chat:
                session.delete(chat)
                session.commit()
                return True
            else:
                return False

    def get_all_chats_by_user_id(self, user_id: int) -> list[ChatOrm]:
        with self.session_factory() as session:
            query = (
                select(
                    ChatOrm
                )
                .select_from(
                    ChatOrm
                )
                .where(ChatOrm.user_id == user_id)
            )
            result = session.execute(query)
            return result.scalars().all()


    #request_responses
    def add_request_response(self, chat_id: int, request_content: str, response_content: str) -> RequestResponseOrm:
        with self.session_factory() as session:
            request_response = RequestResponseOrm(chat_id=chat_id, request_content=request_content,
                                                  response_content=response_content)
            session.add(request_response)
            session.commit()
            session.refresh(request_response)
            return request_response

    def get_all_request_responses_by_chat_id(self, chat_id: int) -> list[RequestResponseOrm]:
        with self.session_factory() as session:
            query = (
                select(
                    RequestResponseOrm
                )
                .select_from(
                    RequestResponseOrm
                )
                .where(RequestResponseOrm.chat_id == chat_id)
            )
            result = session.execute(query)
            return result.scalars().all()

    #collection


    def add_chat_collections_by_qdrant_ids(self, chat_id: int, qdrant_collection_ids: list[int]) -> list[int]:
        with self.session_factory() as session:
            chat_collections = []
            for qdrant_collection_id in qdrant_collection_ids:
                chat_collection = ChatCollectionOrm(
                    chat_id=chat_id,
                    qdrant_collection_id=qdrant_collection_id
                )
                session.add(chat_collection)
                chat_collections.append(chat_collection)

            session.commit()

            # Обновляем объекты, чтобы получить их с ID
            for chat_collection in chat_collections:
                session.refresh(chat_collection)

            return qdrant_collection_ids

    def get_qdrant_collections_by_chat_id(self, chat_id: int) -> list[QdrantCollectionOrm]:
        with self.session_factory() as session:
            query = (
                select(QdrantCollectionOrm)
                .select_from(QdrantCollectionOrm)
                .join(ChatCollectionOrm, QdrantCollectionOrm.id == ChatCollectionOrm.qdrant_collection_id)
                .where(ChatCollectionOrm.chat_id == chat_id)
            )
            result = session.execute(query)
            return result.scalars().all()