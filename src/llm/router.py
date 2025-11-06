from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from src.core.database import engine, session_factory
from src.core.utils.file_util import FileUtil
from src.llm.service import LlmService
from src.llm.mysql import LlmMysql

router = APIRouter(tags=["LLM"])



def get_llm_service() -> LlmService:
    return LlmService(engine=engine, session_factory=session_factory)


def get_llm_mysql() -> LlmMysql:
    return LlmMysql(engine=engine, session_factory=session_factory)

def get_file_util() -> FileUtil:
    return FileUtil()


@router.post("/api/create-chat")
async def create_chat(user_id: int, llm_mysql: LlmMysql = Depends(get_llm_mysql)):

    return llm_mysql.add_chat(user_id)

@router.delete("/api/delete-chat")
async def delete_chat(chat_id: int,  llm_mysql: LlmMysql = Depends(get_llm_mysql)):
    llm_mysql.delete_chat(chat_id)
    return {"message": "chat deleted"}


@router.get("/api/get-history")
async def create_chat(user_id: int, llm_service: LlmService = Depends(get_llm_service)):

    return llm_service.get_history_by_user_id(user_id)







#
# @router.get("/api/search")
# async def create_dictionary(request: str, chat_id: int):
#     try:
#         return llm.generate_response(request=request, chat_id=chat_id)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Ошибка при получении ответа: {str(e)}")
#
