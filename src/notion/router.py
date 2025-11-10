from fastapi import APIRouter, HTTPException, Depends, UploadFile
from starlette.responses import FileResponse
from src.notion.schemes import AnyBlock
from src.notion.service import NotionService
from src.core.utils.file_util import FileUtil

router = APIRouter(tags=["notes"])

def get_notion_service() -> NotionService:
    return NotionService()

def get_file_util() -> FileUtil:
    return FileUtil()

@router.post("/api/notes")
async def create_note(user_id: int, service: NotionService = Depends(get_notion_service)):
    collection_name = await service.create_collection(user_id)
    return {"collection_name": collection_name, "message": "The note has been created successfully."}

@router.delete("/api/notes/{collection_name}")
async def delete_note(collection_name: str, service: NotionService = Depends(get_notion_service)):
    try:
        await service.delete_collection(collection_name)
        return {"collection_name": collection_name, "message": "The note has been successfully deleted."}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Failed to delete note: {e}")

@router.put("/api/notes/update_note_tag")
async def update_qdrant_collection_tag(collection_id: str, new_tag: str, service: NotionService = Depends(get_notion_service)):
    return await service.update_qdrant_collection_tag(collection_id=collection_id, new_tag=new_tag)


@router.get("/api/notes/get_qdrant_collection_without_tag")
async def get_qdrant_collection_without_tag(user_id: int, service: NotionService = Depends(get_notion_service)):
    return await service.get_qdrant_collection_without_tag(user_id=user_id)


@router.get("/api/notes/get_all_tags_with_collections")
async def get_all_tags_with_collections(service: NotionService = Depends(get_notion_service)):
    return await service.get_all_tags_with_collections()

@router.get("/api/notes/{collection_name}")
async def get_note(collection_name: str, service: NotionService = Depends(get_notion_service)):
    collection = await service.get_collection(collection_name)
    return {'collection': collection}

@router.post("/api/notes/{collection_name}/blocks")
async def add_block_to_note(
    collection_name: str,
    block: AnyBlock,
    file: UploadFile | None = None,
    service: NotionService = Depends(get_notion_service)
):
    if file:
        block.server_name = service.file_util.save_file(file.file)
    qdrant_block = await service.add_block(collection_name, block)
    return qdrant_block

@router.put("/api/notes/{collection_name}/blocks/{block_id}")
async def update_block_in_note(
    collection_name: str,
    block: AnyBlock,
    service: NotionService = Depends(get_notion_service)
):
    qdrant_block = await service.update_block(collection_name, block)
    return qdrant_block

@router.delete("/api/notes/{collection_name}/blocks/{block_id}")
async def delete_block_from_note(
    collection_name: str,
    block_id: str,
    service: NotionService = Depends(get_notion_service)
):
    await service.delete_block(collection_name, block_id)
    return {"block_id": block_id, "message": "The block has been successfully deleted."}

@router.get("/api/notes/files/{server_name}")
async def get_file(server_name: str):
    file_path = f"./var/files/{server_name}"
    return FileResponse(
        path=file_path,
        filename=server_name,
        media_type='application/octet-stream'
    )