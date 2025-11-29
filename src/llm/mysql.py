from sqlalchemy import select

from src.llm.models import LlmChatOrm, RequestResponseOrm, ChatContextOrm
from src.notion.models import NotionCollectionOrm


class LlmMysql:
    def __init__(self, engine, session_factory):
        self.engine = engine
        self.session_factory = session_factory


    #LLM Chats
    def add_chat(self) -> LlmChatOrm:
        with self.session_factory() as session:
            chat = LlmChatOrm()
            session.add(chat)
            session.commit()
            session.refresh(chat)
            return chat

    def delete_chat(self, chat_id: int) -> bool:
        with self.session_factory() as session:
            chat = session.get(LlmChatOrm, chat_id)
            if chat:
                session.delete(chat)
                session.commit()
                return True
            else:
                return False

    def get_all_chats(self) -> list[LlmChatOrm]:
        with self.session_factory() as session:
            query = (
                select(
                    LlmChatOrm
                )
                .select_from(
                    LlmChatOrm
                )
            )
            result = session.execute(query)
            return result.scalars().all()

    def get_chat_by_id(self, chat_id: int) -> LlmChatOrm | None:
        with self.session_factory() as session:
            chat = session.get(LlmChatOrm, chat_id)
            return chat

    def update_chat_name(self, chat_id: int, new_name: str) -> LlmChatOrm | None:
        with self.session_factory() as session:
            chat = session.get(LlmChatOrm, chat_id)

            if chat:
                chat.name = new_name
                session.commit()
                return chat
            else:
                return None


    #request_responses
    def add_request_response(self, chat_id: int, request_content: str, response_content: str, documents: list = []) -> RequestResponseOrm:
        with self.session_factory() as session:
            request_response = RequestResponseOrm(chat_id=chat_id, request_content=request_content,
                                                  response_content=response_content, documents=documents)
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


    def add_chat_collection_by_qdrant_id(self, chat_id: int, qdrant_collection_id: int) -> int:
        with self.session_factory() as session:
            chat_collection = ChatContextOrm(
                chat_id=chat_id,
                qdrant_collection_id=qdrant_collection_id
            )
            session.add(chat_collection)
            session.commit()
            
            return qdrant_collection_id 

    def get_qdrant_collections_by_chat_id(self, chat_id: int) -> list[NotionCollectionOrm]:
        with self.session_factory() as session:
            query = (
                select(NotionCollectionOrm)
                .select_from(NotionCollectionOrm)
                .join(ChatContextOrm, NotionCollectionOrm.id == ChatContextOrm.qdrant_collection_id)
                .where(ChatContextOrm.chat_id == chat_id)
            )
            result = session.execute(query)
            return result.scalars().all()
        
    def delete_chat_collection(self, chat_id: int, qdrant_collection_id: int) -> bool:
        with self.session_factory() as session:
            result = (
                session.query(ChatContextOrm)
                .filter(
                    ChatContextOrm.chat_id == chat_id,
                    ChatContextOrm.qdrant_collection_id == qdrant_collection_id
                )
                .delete()
            )
            session.commit()
            
            return result > 0