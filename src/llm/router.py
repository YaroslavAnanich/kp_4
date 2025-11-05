from fastapi import APIRouter, HTTPException, UploadFile, File

from src.project_objects import llm


router = APIRouter(tags=["LLM"])



@router.post("/api/create-chat")
async def create_chat(user_id: int):

    return llm.create_chat(user_id)

@router.get("/api/get-history")
async def create_chat(user_id: int):

    return llm.get_history_by_user_id(user_id)

@router.delete("/api/delete-chat")
async def delete_chat(chat_id: int):
    try:
        return {"message": llm.delete_chat(chat_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении чата: {str(e)}")


@router.post("/api/add-context")
async def add_context(chat_id: int, file: UploadFile = File(...)):
    try:
        file_content = await file.read()
        return {"message": llm.add_context_from_file(chat_id, file_content, file.filename)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при добавлении контекста: {str(e)}")


@router.get("/api/search")
async def create_dictionary(request: str, chat_id: int):
    try:
        return llm.generate_response(request=request, chat_id=chat_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении ответа: {str(e)}")



