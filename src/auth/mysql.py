from src.auth.models import UserOrm
from sqlalchemy import select

class AuthMysql:
    def __init__(self, engine, session_factory):
        self.engine = engine
        self.session_factory = session_factory

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

    def get_user_by_phone(self, phone) -> UserOrm:
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