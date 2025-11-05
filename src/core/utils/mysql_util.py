from datetime import datetime

from sqlalchemy import select
from src.core.database import Base
from src.llm.models import ChatOrm, RequestResponseOrm
from src.auth.models import UserOrm


class MySqlUtil:
    def __init__(self, engine, session_factory):
        self.engine = engine
        self.session_factory = session_factory
        self.create_tables()



    def create_tables(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)




        # inspector = inspect(self.engine)
        # if not inspector.has_table('user'):
        #     Base.metadata.drop_all(self.engine)
        #     Base.metadata.create_all(self.engine)
        # else:
        #     print('Table already exists')


    #Users
    def add_user(self, phone, password) -> UserOrm:
        with self.session_factory() as session:
            user = UserOrm(phone=phone, password=password)
            session.add(user)
            session.commit()
            session.refresh(user)  # Обновляем объект, чтобы получить сгенерированный ID
            return user

    def update_user_tg_id(self, user_id: int, tg_id: int) -> UserOrm:
        with self.session_factory() as session:
            user = session.get(UserOrm, user_id)
            user.tg_id = tg_id
            session.commit()
            session.refresh(user)
            return user

    def get_user_by_phone(self, phone) -> list[UserOrm]:
        with self.session_factory() as session:
            query = (
                select(
                    UserOrm
                )
                .select_from(
                    UserOrm
                )
                .where(UserOrm.phone == phone)
            )
            result = session.execute(query)
            return result.scalars().first()

    def get_user_by_id(self, user_id) -> UserOrm:
        with self.session_factory() as session:
            query = (
                select(
                    UserOrm
                )
                .select_from(
                    UserOrm
                )
                .where(UserOrm.id == user_id)
            )
            user = session.execute(query)
            return user.scalars().first()

    #LLM Chats
    def add_chat(self, user_id) -> ChatOrm:
        with self.session_factory() as session:
            chat = ChatOrm(user_id=user_id, created_at=datetime.now())
            session.add(chat)
            session.commit()
            session.refresh(chat)  # Обновляем объект, чтобы получить сгенерированный ID
            return chat

    def delete_chat(self, chat_id: int) -> None:
        with self.session_factory() as session:
            chat = session.get(ChatOrm, chat_id)
            if chat:
                session.delete(chat)
                session.commit()

    def get_all_chats_by_user_id(self, user_id: int):
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
    def add_request_response(self, chat_id: int, request_content: str, response_content: str):
        with self.session_factory() as session:
            request_response = RequestResponseOrm(chat_id=chat_id, request_content=request_content,
                                       response_content=response_content)
            session.add(request_response)
            session.commit()
            session.refresh(request_response)  # Обновляем объект, чтобы получить сгенерированный ID
            return request_response

    def get_all_request_responses_by_chat_id(self, chat_id: int):
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


