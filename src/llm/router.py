from fastapi import APIRouter, HTTPException, Depends, Query
from src.core.dependencies import get_llm_service, get_notion_service
from src.llm.schemes import AddNotionContextScheme
from src.llm.service import LlmService
from src.notion.service import NotionService


router = APIRouter(tags=["llm"])



@router.post("/llm/chats")
async def create_chat(llm_service: LlmService = Depends(get_llm_service)):
    return llm_service.create_chat()

@router.delete("/llm/chats/{chat_id}")
async def delete_chat(chat_id: int, llm_service: LlmService = Depends(get_llm_service)):
    llm_service.delete_chat(chat_id=chat_id)
    return {"message": "chat deleted"}

@router.get("/llm/chats")
async def get_user_chats(llm_service: LlmService = Depends(get_llm_service)):
    chats = llm_service.get_user_chats()
    name_changed = False
    for chat in chats:
        chat_history = llm_service.get_chat_history(chat_id=chat.id)
        if chat.name == "New chat" and len(chat_history) >= 1:
            llm_service.mysql.update_chat_name(chat_id=chat.id, new_name=chat_history[0].request_content[:100])
            name_changed = True
    if name_changed:
        chats = llm_service.get_user_chats()       
    return chats

@router.get("/llm/chats/{chat_id}/history")
async def get_chat_history(chat_id: int, llm_service: LlmService = Depends(get_llm_service)):
    chat_history = llm_service.get_chat_history(chat_id=chat_id)
    return chat_history



@router.post("/llm/chats/{chat_id}/context/collections")
async def add_collection_context_to_chat(
    chat_id: int,
    collection_id: int,
    llm_service: LlmService = Depends(get_llm_service)
):
    
    return llm_service.add_collection_context_to_chat(
        chat_id=chat_id,
        collection_id=collection_id
    )
    
@router.post("/llm/chats/{chat_id}/context/tags")
async def add_tag_context_to_chat(
    chat_id: int,
    tag_id: int,
    llm_service: LlmService = Depends(get_llm_service),
    notion_service: NotionService = Depends(get_notion_service)
):
    
    collections = notion_service.mysql.get_collections_by_tag_id(tag_id=tag_id)
    for collection in collections:
        llm_service.add_collection_context_to_chat(chat_id=chat_id, collection_id=collection.id)

    return True

@router.get("/llm/chats/{chat_id}/context/collections")
async def get_collection_context_from_chat(
    chat_id: int,
    llm_service: LlmService = Depends(get_llm_service)
):
    return llm_service.get_collection_context_from_chat(chat_id=chat_id)

@router.delete("/llm/chats/{chat_id}/context/{collection_id}")
async def get_collection_context_from_chat(
    chat_id: int,
    collection_id: int,
    llm_service: LlmService = Depends(get_llm_service)
):
    return llm_service.delete_collection_context_from_chat(chat_id=chat_id, qdrant_collection_id=collection_id)

@router.get("/llm/chats/{chat_id}/search")
async def search_in_llm(
    chat_id: int,
    request: str,
    llm_service: LlmService = Depends(get_llm_service),
    notion_service: NotionService = Depends(get_notion_service)
):

    collection_names = []
    collections = llm_service.get_collection_context_from_chat(chat_id=chat_id)
    for collection in collections:
        collection_names.append(collection.qdrant_collection_name)
    qdrant_context, documents = await notion_service.search_in_notion(request, collection_names)
    llm_response = llm_service.search_in_llm(request=request, chat_id=chat_id, qdrant_context=qdrant_context)
    llm_service.mysql.add_request_response(chat_id=chat_id, request_content=request, response_content=llm_response, documents=documents)
    
    return {"response" : llm_response, "documents": documents}
