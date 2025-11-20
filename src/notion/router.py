import uuid

from fastapi import APIRouter, HTTPException, Depends, UploadFile, Path
from starlette.responses import FileResponse
from src.notion.schemes import AnyBlock, FileBlock
from src.notion.service import NotionService
from src.core.utils.file_util import FileUtil
from functools import lru_cache

router = APIRouter(tags=["collections"])

@lru_cache(maxsize=1)
def get_notion_service() -> NotionService:
    return NotionService()

@lru_cache(maxsize=1)
def get_file_util() -> FileUtil:
    return FileUtil()

@router.post("/users/{user_id}/collections")
async def create_collection(user_id: int, name: str, service: NotionService = Depends(get_notion_service)):
    collection = await service.create_collection(user_id=user_id, name=name)
    return collection

@router.delete("/collections/{collection_id}")
async def delete_collection(collection_id: int, service: NotionService = Depends(get_notion_service)):
    try:
        await service.delete_collection(collection_id=collection_id)
        return {"message": "The collection has been successfully deleted."}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Failed to delete collection: {e}")

@router.put("/collections/{collection_id}/tags/{tag_id}")
async def update_collection_tag(collection_id: int, tag_id: str = None, service: NotionService = Depends(get_notion_service)):
    return await service.update_collection_tag(collection_id=collection_id, tag_id=tag_id)


@router.put("/collections/{collection_id}/name")
async def update_collection_name(collection_id: int, name: str, service: NotionService = Depends(get_notion_service)):
    return await service.update_collection_name(collection_id=collection_id, name=name)

@router.put("/collections/{collection_id}/order")
async def update_collection_order_list(collection_id: int, order_list: list[str], service: NotionService = Depends(get_notion_service)):
    return await service.update_collection_order_list(collection_id=collection_id, order_list=order_list)

@router.get("/users/{user_id}/collections")
async def get_all_collections(user_id: int , service: NotionService = Depends(get_notion_service)):
    return await service.get_all_collections(user_id=user_id)

@router.post("/tags")
async def create_tags(user_id: int ,name: str, service: NotionService = Depends(get_notion_service)):
    return await service.create_tag(user_id=user_id, name=name)

@router.delete("/tags/{tag_id}")
async def delete_tag(tag_id: int, service: NotionService = Depends(get_notion_service)):
    return await service.delete_tag(tag_id=tag_id)

@router.get("/tags")
async def get_all_tags(user_id: int, service: NotionService = Depends(get_notion_service)):
    return await service.get_all_tags(user_id=user_id)

@router.get("/collections/{collection_id}")
async def get_collection_content(collection_id: int, service: NotionService = Depends(get_notion_service)):
    content = await service.get_collection_content(collection_id=collection_id)
    return content

@router.post("/collections/{collection_id}/blocks")
async def add_block_to_collection(
    collection_id: int,
    block: AnyBlock,
    service: NotionService = Depends(get_notion_service),
):
    block = await service.add_block(collection_id=collection_id, block=block)
    return block


@router.post("/collections/{collection_id}/file")
async def add_file_block_to_collection(
    collection_id: int,
    block_id: str,
    media_type: str,
    file: UploadFile,
    file_util: FileUtil = Depends(get_file_util),
    service: NotionService = Depends(get_notion_service),
):
    filename, file_path = file_util.save_file(file=file.file, filename=file.filename)
    file_block = FileBlock(id=block_id, media_type=media_type, file_name=filename, file_path=file_path)
    block = await service.add_block(collection_id, file_block)
    return block


@router.delete("/collections/{collection_id}/blocks/{block_id}")
async def delete_block_from_collection(
    collection_id: int,
    block_id: str,
    service: NotionService = Depends(get_notion_service)
):
    await service.delete_block(collection_id=collection_id, block_id=block_id)
    return {"block_id": block_id, "message": "The block has been successfully deleted."}