from pydantic import BaseModel

class AddNotionContextScheme(BaseModel):
    chat_id: int
    collection_ids: list[int]