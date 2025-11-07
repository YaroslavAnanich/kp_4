from fastapi import APIRouter, HTTPException, Depends
from src.auth.schemes import UserScheme
from src.auth.mysql import AuthMysql
from src.core.database import engine, session_factory

router = APIRouter(tags=["auth"])


def get_auth_service() -> AuthMysql:
    return AuthMysql(engine=engine, session_factory=session_factory)


@router.post("/api/register")
async def register(user_scheme: UserScheme, auth_mysql_service: AuthMysql = Depends(get_auth_service)):
    user_from_database = auth_mysql_service.get_user_by_phone(user_scheme.phone)
    if user_from_database is None:
        user = auth_mysql_service.add_user(user_scheme.phone, user_scheme.password)
        return user
    else:
        raise HTTPException(status_code=401, detail=f"A user with this phone number: {user_scheme.phone} already exists.")


@router.post("/api/login")
async def login(user_scheme: UserScheme, auth_mysql_service: AuthMysql = Depends(get_auth_service)):
    user_from_database = auth_mysql_service.get_user_by_phone(user_scheme.phone)

    if user_from_database is None:
        raise HTTPException(status_code=401, detail=f"User with this phone number: {user_scheme.phone} not found")

    if user_from_database.phone == user_scheme.phone and user_from_database.password == user_scheme.password:
        return user_from_database
    else:
        raise HTTPException(status_code=401, detail=f"Incorrect phone number or password entered")


