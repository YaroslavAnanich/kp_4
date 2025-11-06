from fastapi import APIRouter, HTTPException, Depends
from src.auth.schemes import UserScheme
from src.auth.mysql import AuthMysql
from src.core.database import engine, session_factory

router = APIRouter(tags=["Авторизация"])


def get_auth_service() -> AuthMysql:
    return AuthMysql(engine=engine, session_factory=session_factory)


@router.post("/api/register")
async def register(user_scheme: UserScheme, auth_mysql_service: AuthMysql = Depends(get_auth_service)):
    user_from_database = auth_mysql_service.get_user_by_phone(user_scheme.phone)
    if user_from_database is None:
        user = auth_mysql_service.add_user(user_scheme.phone, user_scheme.password)
        return {"message": f"Пользователь c таким телефоном {user.phone} успешно зарегистрирован"}
    else:
        raise HTTPException(status_code=401, detail=f"Пользователь с таким телефоном: {user_scheme.phone} уже существует")


@router.post("/api/login")
async def login(user_scheme: UserScheme, auth_mysql_service: AuthMysql = Depends(get_auth_service)):
    user_from_database = auth_mysql_service.get_user_by_phone(user_scheme.phone)

    if user_from_database is None:
        raise HTTPException(status_code=401, detail=f"Пользователь с таким телефоном: {user_scheme.phone} не найден")

    if user_from_database.phone == user_scheme.phone and user_from_database.password == user_scheme.password:
        return {"user_id": user_from_database.id}
    else:
        raise HTTPException(status_code=401, detail=f"Неверно введен телефон или пароль")


