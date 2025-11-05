from fastapi import APIRouter, HTTPException, Response

from src.project_objects import llm
from src.auth.schemes import UserScheme


router = APIRouter(tags=["Авторизация"])





@router.post("/api/register")
async def register(user_scheme: UserScheme):
    user_from_database = llm.my_sql_manager.get_user_by_phone(user_scheme.phone)
    if user_from_database is None:
        user = llm.my_sql_manager.add_user(user_scheme.phone, user_scheme.password)
        return {"message": f"Пользователь c таким телефоном {user.phone} успешно зарегистрирован"}
    else:
        raise HTTPException(status_code=401, detail=f"Пользователь с таким телефоном: {user_scheme.phone} уже существует")


@router.post("/api/login")
async def login(user_scheme: UserScheme, response: Response):
    user_from_database = llm.my_sql_manager.get_user_by_phone(user_scheme.phone)

    if user_from_database is None:
        raise HTTPException(status_code=401, detail=f"Пользователь с таким телефоном: {user_scheme.phone} не найден")

    if user_from_database.phone == user_scheme.phone and user_from_database.password == user_scheme.password:
        return {"user_id": user_from_database.id}
    else:
        raise HTTPException(status_code=401, detail=f"Неверно введен телефон или пароль")


