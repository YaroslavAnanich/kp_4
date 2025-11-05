import uuid
from fastapi import APIRouter, HTTPException, Depends, UploadFile
from starlette.responses import FileResponse

# Импортируем сервис и модели
from src.notion.schemes import AnyBlock
from src.notion.service import NotionService
from src.core.utils.file_util import FileUtil
# Создаем экземпляр роутера
router = APIRouter(
    prefix="/api/notes",
    tags=["notes"],
)

# --- Зависимости ---

def get_notion_service() -> NotionService:
    return NotionService()

def get_file_util() -> FileUtil:
    return FileUtil()

# --- COLLECTIONS (Notes) Endpoints ---

@router.post("/create-note", summary="Создать новую заметку (коллекцию)")
async def create_note(service: NotionService = Depends(get_notion_service)):
    """Создает новую заметку (колlection Qdrant) с рандомным UUID в качестве имени."""
    collection_name = await service.create_collection()
    return {"collection_name": collection_name, "message": "Заметка успешно создана."}

@router.delete("/{collection_name}/delete-note", summary="Удалить заметку")
async def delete_note(collection_name: str, service: NotionService = Depends(get_notion_service)):
    """Удаляет заметку по ее UUID (collection_name)."""
    try:
        await service.delete_collection(collection_name)
        return {"collection_name": collection_name, "message": "Заметка успешно удалена."}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Не удалось удалить заметку: {e}")

# --- BLOCKS Endpoints ---

@router.post("/{collection_name}/add-block", summary="Добавить новый блок")
async def add_block_to_note(
    collection_name: str,
    block: AnyBlock,
    service: NotionService = Depends(get_notion_service)
):
    """Добавляет новый блок (Text, Header, Table и т.д.) в заметку."""
    qdrant_block = await service.add_block(collection_name, block)
    # ИСПРАВЛЕНИЕ: УБРАТЬ .value
    return qdrant_block
    #

@router.put("/{collection_name}/update-block/{block_id}", summary="Обновить существующий блок")
async def update_block_in_note(
    collection_name: str,
    block: AnyBlock,
    service: NotionService = Depends(get_notion_service)
):
    """Обновляет существующий блок по его ID."""
    qdrant_block = await service.update_block(collection_name, block)
    return qdrant_block


@router.delete("/{collection_name}/delete-block/{block_id}", summary="Удалить блок")
async def delete_block_from_note(
    collection_name: str,
    block_id: str,
    service: NotionService = Depends(get_notion_service)
):
    """Удаляет блок по его ID."""
    await service.delete_block(collection_name, block_id)
    return {"block_id": block_id, "message": "Блок успешно удален."}



@router.get("/notes/{collection_name}", summary="Получить все блоки заметки")
async def get_note(
    collection_name: str,
    service: NotionService = Depends(get_notion_service)
):
    """Возвращает список всех блоков (Payload) из заметки."""
    collection = await service.get_collection(collection_name)
    return {'collection': collection}

@router.post("/files")
async def upload_file(uploaded_file: UploadFile, util: FileUtil = Depends(get_file_util)):
    return util.save_file(uploaded_file.file, uploaded_file.filename)

@router.get("/files/{file_path}")
async def get_file(file_path: str):
    return FileResponse(file_path)

