from fastapi import APIRouter, HTTPException, Depends
from src.core.database import engine, session_factory
from src.llm.schemes import AddNotionContextScheme
from src.llm.service import LlmService
from src.notion.service import NotionService

router = APIRouter(tags=["llm"])

def get_llm_service() -> LlmService:
    return LlmService(engine=engine, session_factory=session_factory)

def get_notion_service() -> NotionService:
    return NotionService()

@router.post("/api/chats")
async def create_chat(user_id: int, llm_service: LlmService = Depends(get_llm_service)):
    return llm_service.create_chat(user_id=user_id)

@router.delete("/api/chats/{chat_id}")
async def delete_chat(chat_id: int, llm_service: LlmService = Depends(get_llm_service)):
    llm_service.delete_chat(chat_id=chat_id)
    return {"message": "chat deleted"}

@router.get("/api/users/{user_id}/chats")
async def get_user_chats(user_id: int, llm_service: LlmService = Depends(get_llm_service)):
    return llm_service.get_user_chats(user_id=user_id)

@router.get("/api/chats/{chat_id}/history")
async def get_chat_history(chat_id: int, llm_service: LlmService = Depends(get_llm_service)):
    return llm_service.get_chat_history(chat_id=chat_id)

@router.post("/api/chats/{chat_id}/context/collections")
async def add_collection_context_to_chat(
    chat_id: int,
    notion_context: AddNotionContextScheme,
    llm_service: LlmService = Depends(get_llm_service)
):
    return llm_service.add_collection_context_to_chat(
        chat_id=chat_id,
        notion_ids=notion_context.collection_ids
    )

@router.get("/api/chats/{chat_id}/context/collections")
async def get_collection_context_from_chat(
    chat_id: int,
    llm_service: LlmService = Depends(get_llm_service)
):
    return llm_service.get_collection_context_from_chat(chat_id=chat_id)

@router.get("/api/chats/{chat_id}/search")
async def search_in_llm(
    chat_id: int,
    request: str,
    llm_service: LlmService = Depends(get_llm_service),
    notion_service: NotionService = Depends(get_notion_service)
):
    try:
        collection_names = []
        collections = llm_service.get_collection_context_from_chat(chat_id=chat_id)
        for collection in collections:
            collection_names.append(collection.name)
        qdrant_context = await notion_service.search_in_notion(request, collection_names)
        return llm_service.search_in_llm(
            request=request,
            chat_id=chat_id,
            qdrant_context=qdrant_context
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при получении ответа: {str(e)}")