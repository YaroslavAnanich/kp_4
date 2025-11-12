import uuid

from fastapi import APIRouter, HTTPException, Depends, UploadFile, Path
from starlette.responses import FileResponse
from src.notion.schemes import AnyBlock
from src.notion.notion_service import NotionService
from src.core.utils.file_util import FileUtil
from functools import lru_cache

router = APIRouter(tags=["notes"])

@lru_cache(maxsize=1)
def get_notion_service() -> NotionService:
    return NotionService()

@lru_cache(maxsize=1)
def get_file_util() -> FileUtil:
    return FileUtil()

@router.post("/users/{user_id}/notes")
async def create_note(user_id: int, name: str, service: NotionService = Depends(get_notion_service)):
    collection = await service.create_collection(user_id=user_id, name=name)
    return collection

@router.delete("/notes/{collection_id}")
async def delete_note(qdrant_id: str, collection_id: str, service: NotionService = Depends(get_notion_service)):
    try:
        await service.delete_collection(qdrant_id=qdrant_id, collection_id=collection_id)
        return {"message": "The note has been successfully deleted."}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Failed to delete note: {e}")

@router.put("/notes/{collection_id}/tags/{tag_id}")
async def update_qdrant_collection(collection_id: str, name: str, tag_id: str = None, service: NotionService = Depends(get_notion_service)):
    db_tag_id = tag_id if tag_id.lower() != 'null' else None
    return await service.update_qdrant_collection(collection_id=collection_id, tag_id=db_tag_id, name=name)

@router.get("/users/{user_id}/notes")
async def get_all_qdrant_collections(user_id: int , service: NotionService = Depends(get_notion_service)):
    return await service.get_all_qdrant_collections(user_id=user_id)

@router.post("/tags")
async def create_tags(user_id: int ,name: str, service: NotionService = Depends(get_notion_service)):
    return await service.create_tag(user_id=user_id, name=name)

@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: int, service: NotionService = Depends(get_notion_service)):
    return await service.delete_tag(tag_id=tag_id)

@router.get("/tags")
async def get_all_tags(user_id: int, service: NotionService = Depends(get_notion_service)):
    return await service.get_all_tags(user_id=user_id)

@router.get("/notes/{collection_name}")
async def get_note(collection_name: str, service: NotionService = Depends(get_notion_service)):
    collection = await service.get_collection(collection_name)
    return {'collection': collection}

@router.post("/notes/{collection_name}/blocks")
async def add_block_to_note(
    collection_name: str,
    block: AnyBlock,
    service: NotionService = Depends(get_notion_service),
):
    qdrant_block = await service.add_block(collection_name, block)
    return qdrant_block

@router.post("/files/{server_name}")
async def get_file(file: UploadFile, file_util: FileUtil = Depends(get_file_util)):
    return file_util.save_file(file=file.file, filename=file.filename)

@router.put("/notes/{collection_name}/blocks/{block_id}")
async def update_block_in_note(
    collection_name: str,
    block: AnyBlock,
    service: NotionService = Depends(get_notion_service)
):
    qdrant_block = await service.update_block(collection_name, block)
    return qdrant_block

@router.delete("/notes/{collection_name}/blocks/{block_id}")
async def delete_block_from_note(
    collection_name: str,
    block_id: str,
    service: NotionService = Depends(get_notion_service)
):
    await service.delete_block(collection_name, block_id)
    return {"block_id": block_id, "message": "The block has been successfully deleted."}



